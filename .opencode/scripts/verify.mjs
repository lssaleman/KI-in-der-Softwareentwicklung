#!/usr/bin/env node
// Verification script of the harness.
//
// Usage:  npm run verify -- <run>            full attempt (numbered)
//         npm run verify -- <run> --quick    quick check while implementing
//         <run> = YYYY-MM-DD_HH-MM_<short-task-description>
//
// Full attempt:
//   1. type check            npx --no-install tsc --noEmit        ┐
//   2. lint                  npx --no-install eslint .            │ in parallel
//   3. unit tests            npm test                             ┘
//   4. accessibility audit   OpenCode tool .opencode/tools/accessibility_audit.ts
//   5. SEO audit             OpenCode tool .opencode/tools/seo_audit.ts
//   6. build                 npm run build (only if 1 and 3 passed)
// The audits call the same OpenCode tools the agent uses (tool.execute), so
// there is only one implementation of every rule.
// Quick check: 1–3 only. While implementing, the agent calls the two tools
// itself. A quick check is not numbered and does not count as an attempt.
// The run is only done after a full attempt passes.
//
// The full output of every check is appended to
//   agent-logs/verification-logs/{syntax,lint,test,audit,build}-logs/<run>.log
// and every full attempt to
//   agent-logs/verification-logs/attempt-logs/<run>.log
// The agent only sees a short summary on stdout.
//
// Stop rule (prevents endless loops):
//   - the last 3 full attempts failed with the same failures, or
//   - 5 full attempts in a row failed.
// Then the script prints "RESULT: STOP" and the agent stops and reports.
// The client can allow more attempts with VERIFY_CONTINUE=1 (the harness
// asks the client for permission because the command does not start with
// "npm run verify").
//
// The agent cannot change this file (.opencode/ is write-protected).
//
// Exit codes: 0 = all passed, 1 = a check failed,
//             2 = usage error or project setup incomplete, 3 = stop.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const CHECK_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_SUMMARY_LINES = 25;
const MAX_SAME_FAILURE = 3;
const MAX_FAILED_IN_A_ROW = 5;
const RUN_NAME = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_[a-z0-9]+(?:-[a-z0-9]+)*$/;

const root = process.cwd();
const logRoot = path.join(root, "agent-logs", "verification-logs");

// ─────────────────────────────────────────────── helpers

function fail(message, code = 2) {
  console.log(message);
  process.exit(code);
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
}

function readPackageJson() {
  const file = path.join(root, "package.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function isInstalled(pkg) {
  try {
    createRequire(path.join(root, "package.json")).resolve(`${pkg}/package.json`);
    return true;
  } catch {
    return false;
  }
}

function hasEslintConfig() {
  return ["eslint.config.mjs", "eslint.config.js", "eslint.config.cjs", "eslint.config.ts"].some(
    (file) => existsSync(path.join(root, file)),
  );
}

/**
 * Picks the lines worth showing to the agent; falls back to the last lines.
 * With block = true, it shows the whole block from the first matching line on
 * (error message, hints, code frame), as Next.js prints the fix below the error.
 */
function relevantLines(output, pattern, block = false) {
  const lines = stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trimEnd().replace(/ {3,}/g, "  "))
    .filter((line) => line.trim() !== "");
  if (block && pattern) {
    const first = lines.findIndex((line) => pattern.test(line));
    if (first >= 0) return lines.slice(first);
  }
  const matching = pattern ? lines.filter((line) => pattern.test(line)) : [];
  return matching.length > 0 ? matching : lines.slice(-MAX_SUMMARY_LINES);
}

function limit(lines) {
  const shown = lines.slice(0, MAX_SUMMARY_LINES);
  if (lines.length > shown.length) {
    shown.push(`... ${lines.length - shown.length} more lines in the log file`);
  }
  return shown;
}

function seconds(ms) {
  return `${Math.max(1, Math.round(ms / 1000))} s`;
}

function runCommand(command) {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: root,
      shell: true,
      env: {
        ...process.env,
        CI: "1",
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    const timer = setTimeout(() => {
      output += `\n[verify] timed out after ${CHECK_TIMEOUT_MS / 60000} minutes`;
      child.kill("SIGKILL");
    }, CHECK_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, output: `${output}\n[verify] ${error.message}`, ms: Date.now() - started });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, output, ms: Date.now() - started });
    });
  });
}

function writeLog(folder, label, body, exitCode) {
  const dir = path.join(logRoot, folder);
  mkdirSync(dir, { recursive: true });
  const header = `=== ${label} | ${new Date().toISOString()} ===`;
  const footer = exitCode === null ? "exit code: not run" : `exit code: ${exitCode}`;
  appendFileSync(
    path.join(dir, `${run}.log`),
    `${header}\n${stripAnsi(body).trimEnd()}\n${footer}\n\n`,
  );
  return path.relative(root, path.join(dir, `${run}.log`));
}

// ─────────────────────────────────────────────── arguments

const args = process.argv.slice(2);
const run = args.find((arg) => !arg.startsWith("--"));
const isQuick = args.includes("--quick");
const unknownFlags = args.filter((arg) => arg.startsWith("--") && arg !== "--quick");
if (!run || !RUN_NAME.test(run) || unknownFlags.length) {
  fail(
    "USAGE: npm run verify -- <run> [--quick]\n" +
      "<run> must look like 2026-11-15_14-30_fussball-seite " +
      "(date, time, short description in lowercase with hyphens).\n" +
      "--quick: type check, lint and tests only (not an attempt).",
  );
}

// ─────────────────────────────────────────────── attempt bookkeeping

const attemptLog = path.join(logRoot, "attempt-logs", `${run}.log`);

/** Full attempts since the last VERIFY_CONTINUE marker. */
function readAttempts() {
  if (!existsSync(attemptLog)) return { total: 0, recent: [] };
  const lines = readFileSync(attemptLog, "utf8").split(/\r?\n/);
  let total = 0;
  let recent = [];
  for (const line of lines) {
    const attempt = /^=== attempt (\d+) \| \S+ \| (PASSED|FAILED|CANNOT VERIFY) \| sig=(\w+)/.exec(line);
    if (attempt) {
      total = Number(attempt[1]);
      recent.push({ result: attempt[2], signature: attempt[3] });
    } else if (line.startsWith("=== continue |")) {
      recent = [];
    }
  }
  return { total, recent };
}

const previous = readAttempts();
const attempt = previous.total + 1;
const label = isQuick ? `quick check after attempt ${previous.total}` : `attempt ${attempt}`;

if (!isQuick && process.env.VERIFY_CONTINUE === "1") {
  mkdirSync(path.dirname(attemptLog), { recursive: true });
  appendFileSync(attemptLog, `=== continue | ${new Date().toISOString()} | allowed by the client ===\n`);
  previous.recent = [];
}

// ─────────────────────────────────────────────── checks

const pkg = readPackageJson();
const summary = [
  isQuick
    ? `VERIFY quick check | run ${run} | no audits and no build, not counted as an attempt`
    : `VERIFY attempt ${attempt} | run ${run}`,
];
const signatureParts = [];
const failedChecks = [];
let cannotRun = false;

function record(name, state, details = [], signatureLines = []) {
  if (state === "FAILED") {
    failedChecks.push(name);
    for (const line of signatureLines) signatureParts.push(`${name}: ${line.replace(/\d+/g, "#").trim()}`);
  }
  if (state === "CANNOT RUN") {
    failedChecks.push(name);
    cannotRun = true;
  }
  summary.push(...details);
}

const commandChecks = [
  {
    name: "type check",
    folder: "syntax-logs",
    command: "npx --no-install tsc --noEmit",
    pattern: /error TS\d+/,
    precondition: () => {
      if (!existsSync(path.join(root, "tsconfig.json"))) return "tsconfig.json is missing.";
      return isInstalled("typescript") ? null : "TypeScript is not installed in the project.";
    },
  },
  {
    name: "lint",
    folder: "lint-logs",
    command: "npx --no-install eslint . --cache --cache-location node_modules/.cache/eslint/",
    pattern: /^\S.*\.(tsx?|jsx?|mjs|cjs)$|\berror\b/,
    skip: () =>
      isInstalled("eslint") && hasEslintConfig()
        ? null
        : "ESLint is not set up; follow the fallback rules in AGENTS.md, Linting and Formatting",
  },
  {
    name: "tests",
    folder: "test-logs",
    command: "npm test",
    pattern: /FAIL|✗|×|AssertionError|Expected|Received|Error:|Tests\s+\d/,
    precondition: () => (pkg?.scripts?.test ? null : 'package.json has no "test" script.'),
  },
];

const commandResults = await Promise.all(
  commandChecks.map(async (check) => {
    const skipped = check.skip?.();
    if (skipped) return { check, skipped };
    const missing = check.precondition?.();
    if (missing) return { check, missing };
    return { check, result: await runCommand(check.command) };
  }),
);

const passedByName = {};
for (const { check, skipped, missing, result } of commandResults) {
  if (skipped) {
    writeLog(check.folder, label, `[verify] skipped: ${skipped}`, null);
    record(check.name, "SKIPPED", [`- ${check.name}: SKIPPED (${skipped})`]);
    passedByName[check.name] = true;
    continue;
  }
  if (missing) {
    writeLog(check.folder, label, `[verify] cannot run: ${missing}`, 1);
    record(check.name, "CANNOT RUN", [`- ${check.name}: CANNOT RUN (${missing})`]);
    passedByName[check.name] = false;
    continue;
  }
  const relLog = writeLog(check.folder, label, result.output, result.exitCode);
  passedByName[check.name] = result.exitCode === 0;
  if (result.exitCode === 0) {
    record(check.name, "PASSED", [`- ${check.name}: PASSED (${seconds(result.ms)})`]);
  } else {
    const lines = relevantLines(result.output, check.pattern);
    record(
      check.name,
      "FAILED",
      [
        `- ${check.name}: FAILED (exit code ${result.exitCode}, ${seconds(result.ms)}, full output: ${relLog})`,
        ...limit(lines).map((line) => `    ${line}`),
      ],
      lines,
    );
  }
}

// ─────────────────────────────────────────────── audits

/** Loads the OpenCode tools and calls them like OpenCode does: execute(args, context). */
async function loadAudits() {
  const { loadTool } = await import("./load-tool.mjs");
  return {
    a11y: await loadTool("accessibility_audit.ts", root),
    seo: await loadTool("seo_audit.ts", root),
  };
}

function formatAudit(name, report, relLog, ms) {
  if (report.status === "error") {
    return {
      state: "FAILED",
      details: [`- ${name}: ERROR (${report.error?.message ?? "unknown error"}, log: ${relLog})`],
      signature: [`error ${report.error?.code}`],
    };
  }
  const blockingSeverities = report.blocking.split(", ");
  const issues = report.issues ?? [];
  const blocking = issues.filter((issue) => blockingSeverities.includes(issue.severity));
  const other = issues.filter((issue) => !blockingSeverities.includes(issue.severity));
  const otherByRule = {};
  for (const issue of other) otherByRule[issue.rule] = (otherByRule[issue.rule] ?? 0) + 1;
  const otherText = Object.entries(otherByRule)
    .map(([rule, count]) => `${rule} (${count})`)
    .join(", ");
  const notCheckable = report.summary?.notCheckable ?? 0;
  const tail = [
    other.length ? `${other.length} non-blocking` : "",
    notCheckable ? `${notCheckable} not checkable statically` : "",
    report.status === "no-pages-found" ? "no page.tsx found" : "",
  ]
    .filter(Boolean)
    .join(", ");

  if (!blocking.length) {
    const details = [`- ${name}: PASSED (${seconds(ms)}${tail ? `; ${tail}` : ""})`];
    if (otherText) details.push(`    non-blocking: ${otherText}`);
    return { state: "PASSED", details, signature: [] };
  }
  const details = [
    `- ${name}: FAILED (${blocking.length} blocking${tail ? `, ${tail}` : ""}; full report: ${relLog})`,
    ...limit(
      blocking.map(
        (issue) =>
          `    [${issue.severity}] ${issue.rule} ${issue.file}${issue.line ? `:${issue.line}` : ""} – ${issue.message} Fix: ${issue.fix}`,
      ),
    ),
  ];
  if (otherText) details.push(`    non-blocking: ${otherText}`);
  return {
    state: "FAILED",
    details,
    signature: blocking.map((issue) => `${issue.rule} ${issue.file}`),
  };
}

let audits = null;
let auditLoadError = null;
if (!isQuick) {
  try {
    audits = await loadAudits();
  } catch (error) {
    auditLoadError = error instanceof Error ? error.message : String(error);
  }
}

for (const [name, key] of isQuick
  ? []
  : [
      ["accessibility audit", "a11y"],
      ["seo audit", "seo"],
    ]) {
  if (!audits) {
    const relLog = writeLog("audit-logs", `${label} | ${name}`, `[verify] cannot run: ${auditLoadError}`, 1);
    record(name, "CANNOT RUN", [`- ${name}: CANNOT RUN (${auditLoadError}; log: ${relLog})`]);
    continue;
  }
  const started = Date.now();
  let report;
  try {
    report = await audits[key](root, "app");
  } catch (error) {
    report = {
      status: "error",
      blocking: "",
      error: { code: "AUDIT_FAILED", message: error instanceof Error ? error.message : String(error) },
    };
  }
  const relLog = writeLog(
    "audit-logs",
    `${label} | ${name}`,
    JSON.stringify(report, null, 2),
    report.status === "failed" || report.status === "error" ? 1 : 0,
  );
  const formatted = formatAudit(name, report, relLog, Date.now() - started);
  record(name, formatted.state, formatted.details, formatted.signature);
}

// ─────────────────────────────────────────────── build (full attempt only)

if (!isQuick) {
  const buildMissing = pkg?.scripts?.build ? null : 'package.json has no "build" script.';
  if (buildMissing) {
    writeLog("build-logs", label, `[verify] cannot run: ${buildMissing}`, 1);
    record("build", "CANNOT RUN", [`- build: CANNOT RUN (${buildMissing})`]);
  } else if (!passedByName["type check"] || !passedByName.tests) {
    writeLog("build-logs", label, "[verify] not run: type check or tests failed", null);
    summary.push("- build: NOT RUN (type check or tests failed)");
    failedChecks.push("build");
  } else {
    const result = await runCommand("npm run build");
    const relLog = writeLog("build-logs", label, result.output, result.exitCode);
    if (result.exitCode === 0) {
      record("build", "PASSED", [`- build: PASSED (${seconds(result.ms)})`]);
    } else {
      const lines = relevantLines(result.output, /error|Error|failed|Failed/, true);
      record(
        "build",
        "FAILED",
        [
          `- build: FAILED (exit code ${result.exitCode}, ${seconds(result.ms)}, full output: ${relLog})`,
          ...limit(lines).map((line) => `    ${line}`),
        ],
        lines,
      );
    }
  }
}

// ─────────────────────────────────────────────── result

const allPassed = failedChecks.length === 0;
const resultLabel = allPassed ? "PASSED" : cannotRun ? "CANNOT VERIFY" : "FAILED";
const signature = createHash("sha1")
  .update([...new Set(signatureParts)].sort().join("\n"))
  .digest("hex")
  .slice(0, 12);

summary.push("");
let exitCode = allPassed ? 0 : cannotRun ? 2 : 1;

if (isQuick) {
  if (allPassed) {
    summary.push(
      "RESULT: QUICK CHECK PASSED. Now call accessibility_audit and seo_audit for the files you changed. " +
        "This is not a verification attempt: run the full verify (without --quick) once the feature is complete.",
    );
  } else if (cannotRun) {
    summary.push(
      "RESULT: CANNOT VERIFY. The project setup is incomplete (see above). " +
        "Do not work around it. Stop and ask the client.",
    );
  } else {
    summary.push("RESULT: QUICK CHECK FAILED. Fix the cause and check again.");
  }
} else {
  mkdirSync(path.dirname(attemptLog), { recursive: true });
  appendFileSync(
    attemptLog,
    `=== attempt ${attempt} | ${new Date().toISOString()} | ${resultLabel} | sig=${allPassed ? "none" : signature} | failed: ${failedChecks.join(", ") || "-"}\n`,
  );
  const recent = [...previous.recent, { result: resultLabel, signature }];
  const failedInARow = [];
  for (let i = recent.length - 1; i >= 0 && recent[i].result === "FAILED"; i--) failedInARow.push(recent[i]);
  const sameFailure =
    failedInARow.length >= MAX_SAME_FAILURE &&
    failedInARow.slice(0, MAX_SAME_FAILURE).every((entry) => entry.signature === signature);

  if (allPassed) {
    summary.push(
      "RESULT: ALL PASSED. Write the verification summary entry. " +
        "List the non-blocking findings and what needs a manual review (manualReview of accessibility_audit, AGENTS.md, Final Report).",
    );
  } else if (cannotRun) {
    summary.push(
      "RESULT: CANNOT VERIFY. The project setup is incomplete (see above). " +
        "Do not work around it. Stop and ask the client.",
    );
  } else if (sameFailure || failedInARow.length >= MAX_FAILED_IN_A_ROW) {
    const reason = sameFailure
      ? `the last ${MAX_SAME_FAILURE} attempts failed with the same failures`
      : `${failedInARow.length} attempts in a row failed`;
    summary.push(
      `RESULT: STOP. ${reason[0].toUpperCase()}${reason.slice(1)}. ` +
        "Do not change any more project files. Write the log entries and report to the client: " +
        "which check fails, what you tried, and whether you think the cause is the code, a test, " +
        "an audit rule (false positive) or SPEC.md (AGENTS.md, When to Stop).",
    );
    exitCode = 3;
  } else {
    summary.push(
      `RESULT: FAILED. Fix all findings above, check with --quick, then start attempt ${attempt + 1}.`,
    );
  }
}

console.log(summary.join("\n"));
process.exit(exitCode);