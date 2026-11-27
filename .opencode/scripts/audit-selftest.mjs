#!/usr/bin/env node
// Self-test of the OpenCode tools accessibility_audit and seo_audit.
//
// Usage:  npm run audit:selftest
//
// audit-fixtures/good: correct, idiomatic code (dynamic texts, next/link with an
//   image, alt="", useId(), generateMetadata, test files with mocks).
//   Expectation: no blocking finding.
// audit-fixtures/bad: one real error per rule.
//   Expectation: every listed rule is found.
//
// Run it after every change to the audit rules, so that a fix for one false
// positive does not hide real errors (or the other way round).

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "audit-fixtures");

// The tools are called exactly as OpenCode calls them: execute(args, context).
const a11yTool = (await import("../tools/accessibility_audit.ts")).default;
const seoTool = (await import("../tools/seo_audit.ts")).default;
const runTool = async (tool, dir) =>
  JSON.parse(await tool.execute({ target: "app" }, { worktree: dir, directory: dir }));
const auditAccessibility = (dir) => runTool(a11yTool, dir);
const auditSeo = (dir) => runTool(seoTool, dir);

const EXPECTED_BAD = {
  accessibility: [
    "image-alt", "image-alt-meaningful", "form-field-label", "button-name", "link-name",
    "frame-title", "media-autoplay", "video-captions", "no-static-element-interactions",
    "tabindex-positive", "html-lang", "aria-role", "aria-labelledby-target",
    "aria-hidden-focus", "table-headers",
  ],
  seo: [
    "title-missing", "meta-description-missing", "canonical-missing", "h1-missing",
    "empty-heading", "link-href-missing", "title-empty", "meta-description-length",
    "canonical-empty", "robots-noindex", "jsonld-invalid",
  ],
};

let failures = 0;
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) failures++;
};
const blocking = (report) =>
  (report.issues ?? []).filter((i) => report.blocking.split(", ").includes(i.severity));

const goodA11y = await auditAccessibility(path.join(fixtures, "good"));
const goodSeo = await auditSeo(path.join(fixtures, "good"));
check(goodA11y.status === "passed", `good: accessibility passed (${goodA11y.status})`);
for (const i of blocking(goodA11y)) console.log(`       false positive: ${i.rule} ${i.file}:${i.line}`);
check(goodSeo.status === "passed", `good: seo passed (${goodSeo.status})`);
for (const i of blocking(goodSeo)) console.log(`       false positive: ${i.rule} ${i.file}:${i.line}`);
check(
  !(goodA11y.issues ?? []).some((i) => i.file.includes(".test.")),
  "good: test files are not audited",
);

const badA11y = await auditAccessibility(path.join(fixtures, "bad"));
const badSeo = await auditSeo(path.join(fixtures, "bad"));
for (const [name, report] of [["accessibility", badA11y], ["seo", badSeo]]) {
  const found = new Set((report.issues ?? []).map((i) => i.rule));
  for (const rule of EXPECTED_BAD[name]) check(found.has(rule), `bad: ${name} finds ${rule}`);
  check(report.status === "failed", `bad: ${name} status failed (${report.status})`);
}

console.log(failures ? `\nSELFTEST FAILED (${failures})` : "\nSELFTEST PASSED");
process.exit(failures ? 1 : 0);
