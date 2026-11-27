#!/usr/bin/env node
// Performance measurement of the harness (SPEC.md, N5).
//
// Usage:  npm run perf -- <run>
//         <run> = the same run name as for `npm run verify`
//
// Runs one measurement:
//   1. checks that the last `npm run verify` attempt of this run built the
//      project successfully (the production build in .next/ is reused),
//   2. starts the production build with `npm start`,
//   3. runs Lighthouse (mobile, category "Performance") for every page
//      in app/ that has a fixed URL,
//   4. stops the server again, even if a measurement fails.
//
// The full output is appended to
//   agent-logs/performance-logs/<run>.log
// and the Lighthouse reports are saved in
//   agent-logs/performance-logs/<run>/
// The agent only sees a short summary on stdout.
//
// Lighthouse is installed by the setup script (setup_durchlauf.sh). The agent
// never installs it itself (AGENTS.md, "General Rules" and "Performance Check").
// The agent cannot change this file (.opencode/ is write-protected).
//
// Exit codes: 0 = all measured criteria passed, 1 = a criterion failed,
//             2 = usage error or measurement not possible.

import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const RUN_NAME = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PORT = Number(process.env.PERF_PORT ?? 3100);
const SERVER_START_TIMEOUT_MS = 60 * 1000;
const LIGHTHOUSE_TIMEOUT_MS = 3 * 60 * 1000;

// Thresholds from SPEC.md, N5.
const MIN_SCORE = 90;
const MAX_LCP_MS = 2500;
const MAX_CLS = 0.1;
const MAX_START_PAGE_BYTES = 1_000_000; // "less than 1 MB"
const TBT_HINT_MS = 200; // lab indicator for INP, not a pass/fail criterion

const root = process.cwd();
const logRoot = path.join(root, "agent-logs", "performance-logs");

// ─────────────────────────────────────────────── helpers

function stop(message) {
  console.log(message);
  process.exit(2);
}

function cannotMeasure(reason, logFile, attempt) {
  if (logFile) appendLog(logFile, attempt, `[perf] cannot measure: ${reason}`);
  stop(
    `PERF attempt ${attempt ?? "-"} | run ${run}\n- measurement: CANNOT RUN (${reason})\n\n` +
      "RESULT: CANNOT MEASURE. Do not work around it. Stop and report to the client.",
  );
}

function appendLog(logFile, attempt, body) {
  const header = `=== attempt ${attempt} | ${new Date().toISOString()} ===`;
  appendFileSync(logFile, `${header}\n${body.trimEnd()}\n\n`);
}

function countAttempts(logFile) {
  if (!existsSync(logFile)) return 0;
  const matches = readFileSync(logFile, "utf8").match(/^=== attempt \d+ \|/gm);
  return matches ? matches.length : 0;
}

function isInstalled(pkg) {
  try {
    createRequire(path.join(root, "package.json")).resolve(`${pkg}/package.json`);
    return true;
  } catch {
    return false;
  }
}

function readPackageJson() {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

/** True if the last attempt in verify's build log ended with exit code 0. */
function lastBuildPassed(run) {
  const file = path.join(root, "agent-logs", "verification-logs", "build-logs", `${run}.log`);
  if (!existsSync(file)) return false;
  const entries = readFileSync(file, "utf8").split(/^=== attempt \d+ \|/m);
  const last = entries[entries.length - 1] ?? "";
  return /^exit code: 0$/m.test(last);
}

/**
 * Finds every page in app/ and derives its URL.
 * Route groups "(name)" are left out of the URL, private folders "_name",
 * parallel routes "@slot" and intercepting routes "(.)name" are skipped.
 * Pages with dynamic segments ("[id]") have no fixed URL and are returned
 * separately, because they cannot be measured without real parameters.
 */
function findPages(appDir) {
  const fixed = [];
  const dynamic = [];

  function walk(dir, segments) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isFile() && /^page\.(tsx|ts|jsx|js|mdx)$/.test(entry.name)) {
        const url = "/" + segments.filter((s) => !/^\(.*\)$/.test(s)).join("/");
        (segments.some((s) => s.startsWith("[")) ? dynamic : fixed).push(url);
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name.startsWith("_") || name.startsWith("@") || name.startsWith("(.")) continue;
      if (name === "node_modules") continue;
      walk(path.join(dir, name), [...segments, name]);
    }
  }

  walk(appDir, []);
  const sort = (list) => [...new Set(list)].sort((a, b) => a.localeCompare(b));
  return { fixed: sort(fixed), dynamic: sort(dynamic) };
}

async function isResponding(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return response.status > 0;
  } catch {
    return false;
  }
}

function startServer(serverOutput) {
  const child = spawn(`npm start -- -p ${PORT}`, {
    cwd: root,
    shell: true,
    detached: process.platform !== "win32",
    env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", PORT: String(PORT) },
  });
  child.stdout.on("data", (chunk) => serverOutput.push(String(chunk)));
  child.stderr.on("data", (chunk) => serverOutput.push(String(chunk)));
  return child;
}

function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      spawnSync(`taskkill /pid ${child.pid} /T /F`, { shell: true });
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch {
    // already stopped
  }
}

async function waitForServer(child, baseUrl) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return false;
    if (await isResponding(baseUrl)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function slugOf(url) {
  return url === "/" ? "start" : url.slice(1).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

function runLighthouse(url, reportFile) {
  const chromeFlags = ["--headless=new"];
  // Chrome refuses to start as root without this flag (e.g. in containers).
  if (process.platform === "linux" && process.getuid?.() === 0) chromeFlags.push("--no-sandbox");

  const command =
    `npx --no-install lighthouse "${url}" --only-categories=performance ` +
    `--output=json --output-path="${reportFile}" --quiet ` +
    `--chrome-flags="${chromeFlags.join(" ")}"`;

  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    timeout: LIGHTHOUSE_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: "1" },
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error || result.status !== 0 || !existsSync(reportFile)) {
    const reason = result.error?.code === "ETIMEDOUT" ? "timed out" : `exit code ${result.status}`;
    return { error: `${reason}${/chrome/i.test(output) ? " (Chrome could not be started?)" : ""}`, output };
  }

  try {
    return { report: JSON.parse(readFileSync(reportFile, "utf8")), output };
  } catch {
    return { error: "the Lighthouse report could not be read", output };
  }
}

function evaluate(url, report) {
  const audits = report.audits ?? {};
  const value = (id) => audits[id]?.numericValue;

  const score = Math.round((report.categories?.performance?.score ?? 0) * 100);
  const lcp = value("largest-contentful-paint");
  const cls = value("cumulative-layout-shift");
  const tbt = value("total-blocking-time");
  const bytes = value("total-byte-weight");

  const checks = [
    { name: "score", ok: score >= MIN_SCORE, text: `score ${score} (min ${MIN_SCORE})` },
    { name: "LCP", ok: lcp !== undefined && lcp <= MAX_LCP_MS, text: `LCP ${lcp === undefined ? "n/a" : (lcp / 1000).toFixed(2) + " s"} (max 2.5 s)` },
    { name: "CLS", ok: cls !== undefined && cls <= MAX_CLS, text: `CLS ${cls === undefined ? "n/a" : cls.toFixed(3)} (max ${MAX_CLS})` },
  ];
  if (url === "/") {
    checks.push({
      name: "transfer",
      ok: bytes !== undefined && bytes < MAX_START_PAGE_BYTES,
      text: `transfer ${bytes === undefined ? "n/a" : Math.round(bytes / 1000) + " kB"} (max 1000 kB)`,
    });
  }

  const hint = tbt === undefined ? "" : ` | TBT ${Math.round(tbt)} ms${tbt > TBT_HINT_MS ? " (above 200 ms, check INP manually)" : ""}`;
  return { checks, hint };
}

// ─────────────────────────────────────────────── arguments and preconditions

const run = process.argv[2];
if (!run || !RUN_NAME.test(run)) {
  stop(
    "USAGE: npm run perf -- <run>\n" +
      "<run> must be the run name you use for npm run verify, " +
      "e.g. 2026-11-15_14-30_fussball-seite.",
  );
}

mkdirSync(path.join(logRoot, run), { recursive: true });
const logFile = path.join(logRoot, `${run}.log`);
const attempt = countAttempts(logFile) + 1;

const pkg = readPackageJson();
if (!pkg?.scripts?.start) cannotMeasure('package.json has no "start" script.', logFile, attempt);
if (!isInstalled("lighthouse")) {
  cannotMeasure("Lighthouse is not installed. Do not install it yourself: report that performance was not measured (AGENTS.md, Performance Check).", logFile, attempt);
}
if (!existsSync(path.join(root, ".next", "BUILD_ID")) || !lastBuildPassed(run)) {
  cannotMeasure(
    `no successful production build for this run. Run npm run verify -- ${run} until it prints RESULT: ALL PASSED.`,
    logFile,
    attempt,
  );
}

const { fixed: pages, dynamic } = findPages(path.join(root, "app"));
if (pages.length === 0) cannotMeasure("no pages with a fixed URL found in app/.", logFile, attempt);

const baseUrl = `http://localhost:${PORT}`;
if (await isResponding(baseUrl)) {
  cannotMeasure(
    `port ${PORT} is already in use (is a dev server running?). Stop it or set PERF_PORT.`,
    logFile,
    attempt,
  );
}

// ─────────────────────────────────────────────── measure

const summary = [`PERF attempt ${attempt} | run ${run} | Lighthouse mobile, category Performance`];
const logBody = [];
const serverOutput = [];
let allPassed = true;
let cannotRun = false;

const server = startServer(serverOutput);
const cleanUp = () => stopServer(server);
process.on("exit", cleanUp);
process.on("SIGINT", () => process.exit(2));
process.on("SIGTERM", () => process.exit(2));

try {
  if (!(await waitForServer(server, baseUrl))) {
    cannotRun = true;
    summary.push("- server: CANNOT RUN (npm start did not respond within 60 s)");
  } else {
    for (const url of pages) {
      const reportFile = path.join(logRoot, run, `attempt-${attempt}-${slugOf(url)}.json`);
      const { report, error, output } = runLighthouse(baseUrl + url, reportFile);
      logBody.push(`--- ${url}\n${output.trim() || "(no output)"}`);

      if (error) {
        cannotRun = true;
        summary.push(`- ${url}: CANNOT RUN (Lighthouse ${error})`);
        continue;
      }

      const { checks, hint } = evaluate(url, report);
      const failed = checks.filter((check) => !check.ok);
      if (failed.length > 0) allPassed = false;
      const line = `- ${url}: ${failed.length === 0 ? "PASSED" : "FAILED"} | ${checks.map((c) => c.text).join(" | ")}${hint}`;
      summary.push(line);
      logBody.push(line);
    }
  }
} finally {
  stopServer(server);
}

for (const url of dynamic) {
  summary.push(`- ${url}: NOT MEASURED (dynamic route, check manually with a real URL)`);
}
summary.push(
  "- not measured automatically: INP (needs real interaction), image sizes, videos loaded only on start",
);

logBody.push(`--- server output\n${serverOutput.join("").trim() || "(no output)"}`);
logBody.push(summary.join("\n"));
appendLog(logFile, attempt, logBody.join("\n\n"));

summary.push("");
summary.push(`Full output: ${path.relative(root, logFile)}`);
if (cannotRun) {
  summary.push("RESULT: CANNOT MEASURE. Do not work around it. Stop and report to the client.");
} else if (allPassed) {
  summary.push("RESULT: ALL PASSED.");
} else {
  summary.push(`RESULT: FAILED. Fix the cause, run npm run verify -- ${run}, then npm run perf -- ${run} again.`);
}

console.log(summary.join("\n"));
process.exit(cannotRun ? 2 : allPassed ? 0 : 1);