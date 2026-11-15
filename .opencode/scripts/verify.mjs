#!/usr/bin/env node
// Verification script of the harness.
//
// Usage:  npm run verify -- <run>
//         <run> = YYYY-MM-DD_HH-MM_<short-task-description>
//
// Runs one attempt of the verification loop:
//   1. type check  (npx --no-install tsc --noEmit)
//   2. unit tests  (npm test)
//   3. build       (npm run build), only if 1 and 2 passed
//
// The full output of every check is appended to
//   agent-logs/verification-logs/{syntax,test,build}-logs/<run>.log
// The agent only sees a short summary on stdout.
//
// The script numbers the attempts of a run itself (from the logs), so the
// numbers in the logs do not depend on the agent. There is no attempt limit:
// the run is limited by the step limit of the agent (opencode.json).
// The agent cannot change this file (.opencode/ is write-protected).
//
// Exit codes: 0 = all passed, 1 = a check failed,
//             2 = usage error or project setup incomplete.

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const CHECK_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_SUMMARY_LINES = 25;
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

function countAttempts(logFile) {
  if (!existsSync(logFile)) return 0;
  const matches = readFileSync(logFile, "utf8").match(/^=== attempt \d+ \|/gm);
  return matches ? matches.length : 0;
}

/** Picks the lines worth showing to the agent; falls back to the last lines. */
function relevantLines(output, pattern) {
  const lines = stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");
  const matching = pattern ? lines.filter((line) => pattern.test(line)) : [];
  const picked = matching.length > 0 ? matching : lines.slice(-MAX_SUMMARY_LINES);
  const shown = picked.slice(0, MAX_SUMMARY_LINES);
  if (picked.length > shown.length) {
    shown.push(`... ${picked.length - shown.length} more lines in the log file`);
  }
  return shown;
}

function runCheck(command) {
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    timeout: CHECK_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      CI: "1",
      FORCE_COLOR: "0",
      NO_COLOR: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error) {
    const reason =
      result.error.code === "ETIMEDOUT"
        ? `timed out after ${CHECK_TIMEOUT_MS / 60000} minutes`
        : result.error.message;
    return { exitCode: 1, output: `${output}\n[verify] ${reason}` };
  }
  return { exitCode: result.status ?? 1, output };
}

function writeLog(logFile, attempt, body, exitCode) {
  const header = `=== attempt ${attempt} | ${new Date().toISOString()} ===`;
  const footer = exitCode === null ? "exit code: not run" : `exit code: ${exitCode}`;
  appendFileSync(logFile, `${header}\n${stripAnsi(body).trimEnd()}\n${footer}\n\n`);
}

// ─────────────────────────────────────────────── arguments

const run = process.argv[2];
if (!run || !RUN_NAME.test(run)) {
  fail(
    "USAGE: npm run verify -- <run>\n" +
      "<run> must look like 2026-11-15_14-30_fussball-seite " +
      "(date, time, short description in lowercase with hyphens).",
  );
}

const checks = [
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
    name: "tests",
    folder: "test-logs",
    command: "npm test",
    pattern: /FAIL|✗|×|AssertionError|Expected|Received|Error:|Tests\s+\d/,
    precondition: (pkg) => (pkg?.scripts?.test ? null : 'package.json has no "test" script.'),
  },
  {
    name: "build",
    folder: "build-logs",
    command: "npm run build",
    pattern: /error|Error|failed|Failed/,
    precondition: (pkg) => (pkg?.scripts?.build ? null : 'package.json has no "build" script.'),
  },
];

for (const check of checks) {
  mkdirSync(path.join(logRoot, check.folder), { recursive: true });
  check.logFile = path.join(logRoot, check.folder, `${run}.log`);
}

const previousAttempts = countAttempts(checks[0].logFile);
const attempt = previousAttempts + 1;
const pkg = readPackageJson();

// ─────────────────────────────────────────────── run the checks

const summary = [`VERIFY attempt ${attempt} | run ${run}`];
let allPassed = true;
let earlierFailed = false;
let cannotRun = false;

for (const check of checks) {
  const relLog = path.relative(root, check.logFile);

  if (check.name === "build" && earlierFailed) {
    writeLog(check.logFile, attempt, "[verify] not run: an earlier check failed", null);
    summary.push(`- ${check.name}: NOT RUN (earlier check failed)`);
    continue;
  }

  const missing = check.precondition(pkg);
  if (missing) {
    writeLog(check.logFile, attempt, `[verify] cannot run: ${missing}`, 1);
    summary.push(`- ${check.name}: CANNOT RUN (${missing})`);
    allPassed = false;
    cannotRun = true;
    earlierFailed = true;
    continue;
  }

  const { exitCode, output } = runCheck(check.command);
  writeLog(check.logFile, attempt, output, exitCode);

  if (exitCode === 0) {
    summary.push(`- ${check.name}: PASSED`);
  } else {
    allPassed = false;
    earlierFailed = true;
    summary.push(`- ${check.name}: FAILED (exit code ${exitCode}, full output: ${relLog})`);
    for (const line of relevantLines(output, check.pattern)) summary.push(`    ${line}`);
  }
}

summary.push("");
if (allPassed) {
  summary.push("RESULT: ALL PASSED. Now run accessibility_audit and seo_audit.");
} else if (cannotRun) {
  summary.push(
    "RESULT: CANNOT VERIFY. The project setup is incomplete (see above). " +
      "Do not work around it. Stop and ask the client.",
  );
} else {
  summary.push(`RESULT: FAILED. Fix the cause, then start attempt ${attempt + 1}.`);
}

console.log(summary.join("\n"));
process.exit(allPassed ? 0 : cannotRun ? 2 : 1);
