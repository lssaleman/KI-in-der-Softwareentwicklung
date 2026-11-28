/// <reference types="node" />

// Static accessibility audit (WCAG 2.2 A/AA) for React/Next.js source code.
//
// OpenCode tool. The agent calls it while implementing; `npm run verify`
// calls the same tool in every full attempt.
//
// Checked (static, per file):
//   1.1.1  image-alt, image-alt-meaningful   <img>, next/image
//   1.2.2  video-captions                     <video> without <track kind="captions">
//   1.3.1  form-field-label, table-headers    <input>/<select>/<textarea>, <table>
//   1.4.2  media-autoplay                     <video>/<audio autoPlay>   (SPEC F1, N3)
//   2.1.1  no-static-element-interactions     onClick on <div>, <span> …
//   2.4.3  tabindex-positive
//   2.4.4  link-name                          <a>, next/link
//   3.1.1  html-lang                          <html> in layout files
//   4.1.2  button-name, frame-title, aria-role, aria-hidden-focus,
//          aria-labelledby-target, duplicate-id
//
// Not checkable statically (manual review in the browser): contrast (1.4.3,
// 1.4.11), reflow and zoom (1.4.4, 1.4.10), keyboard operation and focus
// (2.1.1 at runtime, 2.1.2, 2.4.7, 2.4.11), target size (2.5.8), error
// messages and status messages (3.3.1, 3.3.3, 4.1.3), plain language.
// The page title (2.4.2) is checked by seo_audit.
//
// Values that cannot be evaluated statically ({sport.name}, useId(), props,
// components as children) count as present. They are listed under
// "notCheckable" instead of being reported as violations.
//
// Blocking: critical and serious findings. moderate and minor findings are
// reported but do not block.
//
// The file is self-contained on purpose: OpenCode turns every export of a
// file in .opencode/tools/ into a tool, so the only export is the tool itself.
// Plain TypeScript without enums or namespaces, so OpenCode (Bun) and Node
// (type stripping, used by verify.mjs) can both run it.

import { tool } from "@opencode-ai/plugin";
import { parse } from "@typescript-eslint/parser";
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

// ═══════════════════════════════════════════════ Shared static-analysis helpers
//
// A static audit cannot know runtime values. Every value is therefore one of
// three kinds:
//   static  – a string literal that can be checked,
//   dynamic – an expression ({sport.name}, useId(), a prop) that cannot be
//             evaluated; it counts as present and is never reported as missing,
//   absent  – the attribute or content does not exist.
// Only "absent" or clearly wrong static values produce findings.

// ─────────────────────────────────────────────────────────────── Types

type Severity = "critical" | "serious" | "moderate" | "minor";

interface Issue {
  file: string;
  line: number | null;
  rule: string;
  severity: Severity;
  message: string;
  fix: string;
  wcag?: string[];
}

interface NotCheckable {
  file: string;
  line: number | null;
  rule: string;
}

type Node = Record<string, unknown> & {
  type: string;
  loc?: { start: { line: number; column: number } };
  range?: [number, number];
};

type AttrValue =
  | { kind: "static"; value: string }
  | { kind: "dynamic"; source: string }
  | { kind: "boolean" };

interface Attrs {
  map: Map<string, AttrValue>;
  hasSpread: boolean;
}

interface ParsedFile {
  absPath: string;
  relPath: string;
  source: string;
  ast: Node;
}

const SEVERITIES: Severity[] = ["critical", "serious", "moderate", "minor"];

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const SOURCE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".opencode",
  "agent-logs",
  "coverage",
  "dist",
  "build",
  "out",
  "supabase",
]);

// ─────────────────────────────────────────────────────── Files & paths

/** Test files and type declarations are never audited: they are not shipped. */
function isAuditableFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (!SOURCE_EXTENSIONS.includes(path.extname(lower))) return false;
  if (/\.(test|spec)\.[jt]sx?$/.test(lower)) return false;
  if (lower.endsWith(".d.ts")) return false;
  return true;
}

function isPageFile(fileName: string): boolean {
  return /^page\.[jt]sx?$/.test(path.basename(fileName).toLowerCase());
}

async function* discoverFiles(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) yield* discoverFiles(full);
    } else if (entry.isFile() && isAuditableFile(entry.name)) {
      yield full;
    }
  }
}

interface TargetResult {
  root: string;
  files: string[];
  error?: { code: string; message: string };
}

/** Resolves the target inside the project and lists the auditable files. */
async function resolveTarget(rootDir: string, target: string): Promise<TargetResult> {
  const root = path.resolve(rootDir);
  const requested = path.resolve(root, target || ".");
  const relative = path.relative(root, requested);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return {
      root,
      files: [],
      error: { code: "PATH_OUTSIDE_PROJECT", message: "Das Ziel muss im Projekt liegen." },
    };
  }
  const info = await stat(requested).catch(() => null);
  if (!info) {
    return { root, files: [], error: { code: "NOT_FOUND", message: `Pfad nicht gefunden: ${target}` } };
  }
  if (info.isFile()) {
    if (!isAuditableFile(path.basename(requested))) {
      return {
        root,
        files: [],
        error: {
          code: "INVALID_FILE_TYPE",
          message: "Erwartet eine .tsx/.ts/.jsx/.js-Datei (keine Test- oder .d.ts-Datei).",
        },
      };
    }
    return { root, files: [requested] };
  }
  const files: string[] = [];
  for await (const file of discoverFiles(requested)) files.push(file);
  return { root, files };
}

const parseCache = new Map<string, { mtimeMs: number; parsed: ParsedFile | null }>();

/** Parses a TS/TSX/JS file. Returns null if the file is too large or invalid. */
async function parseFile(absPath: string, root: string): Promise<ParsedFile | null> {
  const info = await stat(absPath).catch(() => null);
  if (!info || !info.isFile() || info.size > MAX_FILE_SIZE) return null;
  const cached = parseCache.get(absPath);
  if (cached && cached.mtimeMs === info.mtimeMs) return cached.parsed;

  let parsed: ParsedFile | null = null;
  try {
    const source = await readFile(absPath, "utf8");
    const ast = parse(source, {
      jsx: true,
      loc: true,
      range: true,
      comment: false,
      tokens: false,
      errorOnUnknownASTType: false,
    }) as unknown as Node;
    parsed = { absPath, relPath: path.relative(root, absPath), source, ast };
  } catch {
    parsed = null;
  }
  parseCache.set(absPath, { mtimeMs: info.mtimeMs, parsed });
  return parsed;
}

/** Resolves a project import ("@/…" or relative) to a file; packages return null. */
function resolveImport(specifier: string, fromFile: string, root: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(root, specifier.slice(2));
  else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else return null;

  const candidates = [base, ...SOURCE_EXTENSIONS.map((ext) => base + ext)];
  for (const ext of SOURCE_EXTENSIONS) candidates.push(path.join(base, `index${ext}`));
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile() && isAuditableFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────── AST walk

const SKIP_KEYS = new Set(["parent", "loc", "range", "tokens", "comments"]);

/** Depth-first walk with the list of ancestors (outermost first). */
function walk(node: unknown, visit: (node: Node, ancestors: Node[]) => void): void {
  const ancestors: Node[] = [];
  const step = (current: unknown): void => {
    if (!current || typeof current !== "object") return;
    if (Array.isArray(current)) {
      for (const item of current) step(item);
      return;
    }
    const n = current as Node;
    const isNode = typeof n.type === "string";
    if (isNode) visit(n, ancestors);
    if (isNode) ancestors.push(n);
    for (const key of Object.keys(n)) {
      if (SKIP_KEYS.has(key)) continue;
      const child = n[key];
      if (child && typeof child === "object") step(child);
    }
    if (isNode) ancestors.pop();
  };
  step(node);
}

function lineOf(node: Node | null | undefined): number | null {
  return node?.loc?.start.line ?? null;
}

function sourceOf(file: ParsedFile, node: Node): string {
  return node.range ? file.source.slice(node.range[0], node.range[1]) : "";
}

// ───────────────────────────────────────────────────────── Imports

interface ImportBinding {
  source: string;
  imported: string; // "default", "*" or the exported name
}

/** Maps local names to their import, e.g. Link → { source: "next/link", imported: "default" }. */
function collectImports(ast: Node): Map<string, ImportBinding> {
  const imports = new Map<string, ImportBinding>();
  for (const statement of (ast.body as Node[]) ?? []) {
    if (statement.type !== "ImportDeclaration") continue;
    const source = String((statement.source as Node).value ?? "");
    for (const spec of (statement.specifiers as Node[]) ?? []) {
      const local = String((spec.local as Node).name ?? "");
      if (spec.type === "ImportDefaultSpecifier") imports.set(local, { source, imported: "default" });
      else if (spec.type === "ImportNamespaceSpecifier") imports.set(local, { source, imported: "*" });
      else if (spec.type === "ImportSpecifier") {
        const imported = spec.imported as Node;
        imports.set(local, { source, imported: String(imported.name ?? imported.value ?? "") });
      }
    }
  }
  return imports;
}

/** Local names that refer to the default export of a package, e.g. all names bound to next/link. */
function namesBoundTo(imports: Map<string, ImportBinding>, source: string): Set<string> {
  const names = new Set<string>();
  for (const [local, binding] of imports) {
    if (binding.source === source && binding.imported === "default") names.add(local);
  }
  return names;
}

// ─────────────────────────────────────────────────────── JSX helpers

/** "a", "Link", "Foo.Bar" – the element name as written in the source. */
function elementName(opening: Node): string {
  const nameNode = opening.name as Node;
  if (nameNode.type === "JSXIdentifier") return String(nameNode.name);
  if (nameNode.type === "JSXMemberExpression") {
    const object = elementName({ type: "x", name: nameNode.object } as unknown as Node);
    return `${object}.${String((nameNode.property as Node).name)}`;
  }
  if (nameNode.type === "JSXNamespacedName") {
    return `${String((nameNode.namespace as Node).name)}:${String((nameNode.name as Node).name)}`;
  }
  return "";
}

/** Intrinsic HTML/SVG elements start with a lowercase letter. */
function isIntrinsic(name: string): boolean {
  return /^[a-z]/.test(name) && !name.includes(".");
}

/** Evaluates an expression to a string if it is a literal; otherwise null. */
function literalString(expr: Node | null | undefined): string | null {
  if (!expr) return null;
  if (expr.type === "Literal") {
    const value = expr.value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return null;
  }
  if (expr.type === "TemplateLiteral" && ((expr.expressions as Node[]) ?? []).length === 0) {
    const quasis = expr.quasis as Node[];
    return String((quasis[0]?.value as { cooked?: string })?.cooked ?? "");
  }
  if (expr.type === "TSAsExpression" || expr.type === "TSSatisfiesExpression") {
    return literalString(expr.expression as Node);
  }
  return null;
}

function readAttrs(file: ParsedFile, opening: Node): Attrs {
  const map = new Map<string, AttrValue>();
  let hasSpread = false;
  for (const attr of (opening.attributes as Node[]) ?? []) {
    if (attr.type === "JSXSpreadAttribute") {
      hasSpread = true;
      continue;
    }
    if (attr.type !== "JSXAttribute") continue;
    const nameNode = attr.name as Node;
    const name =
      nameNode.type === "JSXNamespacedName"
        ? `${String((nameNode.namespace as Node).name)}:${String((nameNode.name as Node).name)}`
        : String(nameNode.name);
    const value = attr.value as Node | null;
    let result: AttrValue;
    if (!value) result = { kind: "boolean" };
    else if (value.type === "Literal") result = { kind: "static", value: String(value.value ?? "") };
    else if (value.type === "JSXExpressionContainer") {
      const expr = value.expression as Node;
      const literal = literalString(expr);
      if (literal !== null) result = { kind: "static", value: literal };
      else if (expr.type === "JSXEmptyExpression") result = { kind: "static", value: "" };
      else result = { kind: "dynamic", source: sourceOf(file, expr) };
    } else result = { kind: "dynamic", source: sourceOf(file, value) };
    map.set(name.toLowerCase(), result);
  }
  return { map, hasSpread };
}

/** true for static "true"/boolean attribute, false for static "false"/absent, null when dynamic. */
function attrIsTrue(attrs: Attrs, name: string): boolean | null {
  const value = attrs.map.get(name);
  if (!value) return false;
  if (value.kind === "boolean") return true;
  if (value.kind === "dynamic") return null;
  return value.value.toLowerCase() === "true";
}

/** A static non-empty value, or a dynamic one (which counts as present). */
function attrIsPresent(attrs: Attrs, name: string): boolean {
  const value = attrs.map.get(name);
  if (!value) return false;
  if (value.kind === "dynamic") return true;
  if (value.kind === "boolean") return false;
  return value.value.trim() !== "";
}

interface TextResult {
  text: string;
  /** true if part of the content cannot be evaluated statically (expressions, components). */
  unknown: boolean;
}

interface TextContext {
  file: ParsedFile;
  /** Local names of image components (e.g. next/image) whose alt counts as text. */
  imageComponents: Set<string>;
}

/**
 * Text content of a JSX element as a screen reader would get it:
 * text, literal expressions, alt of contained images and <title> of SVGs.
 * Expressions and components that cannot be evaluated make the result "unknown".
 * Children with aria-hidden="true" are ignored.
 */
function textContent(element: Node, ctx: TextContext): TextResult {
  let text = "";
  let unknown = false;
  for (const child of (element.children as Node[]) ?? []) {
    if (child.type === "JSXText") {
      text += ` ${String(child.value ?? "")}`;
    } else if (child.type === "JSXExpressionContainer") {
      const expr = child.expression as Node;
      if (expr.type === "JSXEmptyExpression") continue;
      const literal = literalString(expr);
      if (literal !== null) text += ` ${literal}`;
      else if (expr.type === "JSXElement" || expr.type === "JSXFragment") {
        const inner = textContent({ type: "x", children: [expr] } as unknown as Node, ctx);
        text += ` ${inner.text}`;
        unknown = unknown || inner.unknown;
      } else unknown = true;
    } else if (child.type === "JSXFragment") {
      const inner = textContent(child, ctx);
      text += ` ${inner.text}`;
      unknown = unknown || inner.unknown;
    } else if (child.type === "JSXElement") {
      const opening = child.openingElement as Node;
      const name = elementName(opening);
      const attrs = readAttrs(ctx.file, opening);
      const hidden = attrIsTrue(attrs, "aria-hidden");
      if (hidden === true) continue;
      if (attrs.hasSpread) {
        unknown = true;
        continue;
      }
      const ariaLabel = attrs.map.get("aria-label");
      if (ariaLabel?.kind === "dynamic" || attrs.map.has("aria-labelledby")) {
        unknown = true;
        continue;
      }
      if (ariaLabel?.kind === "static" && ariaLabel.value.trim()) {
        text += ` ${ariaLabel.value}`;
        continue;
      }
      if (name === "img" || ctx.imageComponents.has(name)) {
        const alt = attrs.map.get("alt");
        if (alt?.kind === "static") text += ` ${alt.value}`;
        else if (alt?.kind === "dynamic") unknown = true;
        continue;
      }
      if (name === "svg") {
        const titleChild = ((child.children as Node[]) ?? []).find(
          (c) => c.type === "JSXElement" && elementName(c.openingElement as Node) === "title",
        );
        if (titleChild) {
          const inner = textContent(titleChild, ctx);
          text += ` ${inner.text}`;
          unknown = unknown || inner.unknown;
        }
        continue;
      }
      if (isIntrinsic(name)) {
        const inner = textContent(child, ctx);
        text += ` ${inner.text}`;
        unknown = unknown || inner.unknown;
      } else {
        // A component can render any text: we cannot know it statically.
        unknown = true;
      }
    }
  }
  return { text: text.replace(/\s+/g, " ").trim(), unknown };
}

// ────────────────────────────────────────── Static object evaluation

type StaticValue =
  | { kind: "string"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "other" } // number, null, regex …
  | { kind: "dynamic" }
  | { kind: "object"; props: Map<string, StaticValue>; hasSpread: boolean }
  | { kind: "array"; items: StaticValue[] };

/** Evaluates object literals as far as possible; everything else becomes "dynamic". */
function evaluate(expr: Node | null | undefined): StaticValue {
  if (!expr) return { kind: "dynamic" };
  if (expr.type === "TSAsExpression" || expr.type === "TSSatisfiesExpression") {
    return evaluate(expr.expression as Node);
  }
  if (expr.type === "Literal" && typeof expr.value === "boolean") {
    return { kind: "boolean", value: expr.value };
  }
  if (expr.type === "Literal" && typeof expr.value !== "string") return { kind: "other" };
  const literal = literalString(expr);
  if (literal !== null) return { kind: "string", value: literal };
  if (expr.type === "ObjectExpression") {
    const props = new Map<string, StaticValue>();
    let hasSpread = false;
    for (const prop of (expr.properties as Node[]) ?? []) {
      if (prop.type === "SpreadElement") {
        hasSpread = true;
        continue;
      }
      if (prop.type !== "Property") continue;
      const key = prop.key as Node;
      let name: string | null = null;
      if (!prop.computed && key.type === "Identifier") name = String(key.name);
      else if (key.type === "Literal") name = String(key.value);
      if (name === null) {
        hasSpread = true;
        continue;
      }
      props.set(name, prop.shorthand ? { kind: "dynamic" } : evaluate(prop.value as Node));
    }
    return { kind: "object", props, hasSpread };
  }
  if (expr.type === "ArrayExpression") {
    return {
      kind: "array",
      items: ((expr.elements as Node[]) ?? []).map((item) =>
        item && item.type !== "SpreadElement" ? evaluate(item) : { kind: "dynamic" },
      ),
    };
  }
  return { kind: "dynamic" };
}

/** Reads a nested property. Returns "absent" only when the object is fully known. */
function getProp(
  value: StaticValue,
  pathParts: string[],
): StaticValue | "absent" {
  let current: StaticValue = value;
  for (const part of pathParts) {
    if (current.kind !== "object") return current.kind === "dynamic" ? current : "absent";
    const next = current.props.get(part);
    if (!next) return current.hasSpread ? { kind: "dynamic" } : "absent";
    current = next;
  }
  return current;
}

// ──────────────────────────────────────────────────────── Reporting

function countBySeverity(issues: Issue[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const issue of issues) counts[issue.severity]++;
  return counts;
}

function countByRule(items: { rule: string }[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.rule, (counts.get(item.rule) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) =>
      SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0),
  );
}

// ═══════════════════════════════════════════════ Rules


const BLOCKING_SEVERITIES: Severity[] = ["critical", "serious"];

interface AccessibilityReport {
  tool: "accessibility_audit";
  standard: "WCAG 2.2 AA";
  status: "passed" | "failed" | "error";
  blocking: string;
  summary?: {
    filesAudited: number;
    filesSkipped: number;
    bySeverity: Record<Severity, number>;
    byRule: Record<string, number>;
    notCheckable: number;
  };
  issues?: Issue[];
  notCheckable?: { byRule: Record<string, number>; examples: NotCheckable[] };
  manualReview?: string[];
  error?: { code: string; message: string };
}

const MANUAL_REVIEW = [
  "Farbkontrast Text und Bedienelemente (1.4.3, 1.4.11)",
  "Zoom 200 % und Reflow ab 320 px (1.4.4, 1.4.10)",
  "Tastaturbedienung, Fokusreihenfolge, sichtbarer und nicht verdeckter Fokus (2.1.1, 2.1.2, 2.4.3, 2.4.7, 2.4.11)",
  "Zielgröße mind. 24 × 24 px, laut SPEC N4 44 × 44 px (2.5.8)",
  "Fehlermeldungen und Statusmeldungen im Formular (3.3.1, 3.3.3, 4.1.3)",
  "Information nicht nur über Farbe (1.4.1), verständliche Sprache",
  "Alle Stellen unter notCheckable (dynamische Werte)",
];

const GENERIC_ALT =
  /^(bild|image|img|foto|photo|picture|grafik|graphic|icon|logo|banner|platzhalter|placeholder|todo)$/i;
const FILENAME_ALT = /\.(png|jpe?g|gif|svg|webp|avif)$/i;

const STATIC_TAGS = new Set([
  "div", "span", "p", "li", "ul", "ol", "section", "article", "aside", "header",
  "footer", "main", "nav", "h1", "h2", "h3", "h4", "h5", "h6", "td", "tr", "img",
  "label", "figure", "form",
]);
const WIDGET_ROLES = new Set([
  "button", "link", "menuitem", "menuitemcheckbox", "menuitemradio", "option",
  "radio", "checkbox", "switch", "tab", "treeitem", "slider", "spinbutton",
]);
const SKIP_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image"]);

const VALID_ROLES = new Set([
  "alert", "alertdialog", "application", "article", "banner", "blockquote", "button",
  "caption", "cell", "checkbox", "code", "columnheader", "combobox", "comment",
  "complementary", "contentinfo", "definition", "deletion", "dialog", "directory",
  "document", "emphasis", "feed", "figure", "form", "generic", "grid", "gridcell",
  "group", "heading", "image", "img", "insertion", "link", "list", "listbox",
  "listitem", "log", "main", "mark", "marquee", "math", "menu", "menubar", "menuitem",
  "menuitemcheckbox", "menuitemradio", "meter", "navigation", "none", "note", "option",
  "paragraph", "presentation", "progressbar", "radio", "radiogroup", "region", "row",
  "rowgroup", "rowheader", "scrollbar", "search", "searchbox", "sectionfooter",
  "sectionheader", "separator", "slider", "spinbutton", "status", "strong",
  "subscript", "suggestion", "superscript", "switch", "tab", "table", "tablist",
  "tabpanel", "term", "textbox", "time", "timer", "toolbar", "tooltip", "tree",
  "treegrid", "treeitem",
]);

interface FileContext {
  file: ParsedFile;
  issues: Issue[];
  notCheckable: NotCheckable[];
  text: TextContext;
  linkComponents: Set<string>;
  imageComponents: Set<string>;
  add(node: Node, rule: string, severity: Severity, wcag: string[], message: string, fix: string): void;
  unknown(node: Node, rule: string): void;
}

interface Element {
  node: Node;
  opening: Node;
  name: string;
  attrs: Attrs;
  ancestors: Node[];
}

type NameResult = "present" | "empty" | "unknown";

/** Accessible name: aria-labelledby > aria-label > title > content. */
function accessibleName(ctx: FileContext, el: Element): NameResult {
  if (el.attrs.hasSpread) return "unknown";
  if (el.attrs.map.has("aria-labelledby")) return "present";
  const ariaLabel = el.attrs.map.get("aria-label");
  if (ariaLabel?.kind === "dynamic") return "unknown";
  if (ariaLabel?.kind === "static" && ariaLabel.value.trim()) return "present";
  const title = el.attrs.map.get("title");
  if (title?.kind === "dynamic") return "unknown";
  if (title?.kind === "static" && title.value.trim()) return "present";
  const content = textContent(el.node, ctx.text);
  if (content.text) return "present";
  return content.unknown ? "unknown" : "empty";
}

function collectElements(file: ParsedFile): Element[] {
  const elements: Element[] = [];
  walk(file.ast, (node, ancestors) => {
    if (node.type !== "JSXElement") return;
    const opening = node.openingElement as Node;
    elements.push({
      node,
      opening,
      name: elementName(opening),
      attrs: readAttrs(file, opening),
      ancestors: [...ancestors],
    });
  });
  return elements;
}

// ───────────────────────────────────────────────────────────── Rules

function ruleImages(ctx: FileContext, elements: Element[]): void {
  for (const el of elements) {
    if (el.name !== "img" && !ctx.imageComponents.has(el.name)) continue;
    if (el.attrs.hasSpread) {
      ctx.unknown(el.opening, "image-alt");
      continue;
    }
    const role = el.attrs.map.get("role");
    const isPresentational =
      role?.kind === "static" && ["presentation", "none"].includes(role.value.trim());
    if (isPresentational || attrIsTrue(el.attrs, "aria-hidden") === true) continue;

    const alt = el.attrs.map.get("alt");
    if (!alt) {
      ctx.add(el.opening, "image-alt", "critical", ["1.1.1"],
        "Das Bild hat kein alt-Attribut.",
        'Inhaltliches Bild: alt="Was das Bild zeigt oder bewirkt". Rein dekoratives Bild: alt="".');
    } else if (alt.kind === "dynamic") {
      ctx.unknown(el.opening, "image-alt-meaningful");
    } else if (alt.kind === "static") {
      const value = alt.value.trim();
      if (value && (GENERIC_ALT.test(value) || FILENAME_ALT.test(value))) {
        ctx.add(el.opening, "image-alt-meaningful", "serious", ["1.1.1"],
          `alt="${value}" beschreibt nur den Bildtyp oder Dateinamen, nicht den Inhalt.`,
          'Beschreibe Inhalt oder Zweck (z. B. "Logo des Sponsors Bäckerei Schmidt"). Dekorativ: alt="".');
      }
    }
  }
}

function ruleFormLabels(ctx: FileContext, elements: Element[]): void {
  const staticFor = new Set<string>();
  const dynamicFor = new Set<string>();
  for (const el of elements) {
    if (el.name !== "label") continue;
    const htmlFor = el.attrs.map.get("htmlfor") ?? el.attrs.map.get("for");
    if (htmlFor?.kind === "static") staticFor.add(htmlFor.value.trim());
    if (htmlFor?.kind === "dynamic") dynamicFor.add(htmlFor.source.trim());
  }

  for (const el of elements) {
    if (!["input", "select", "textarea"].includes(el.name)) continue;
    if (el.attrs.hasSpread) {
      ctx.unknown(el.opening, "form-field-label");
      continue;
    }
    const type = el.attrs.map.get("type");
    if (type?.kind === "static" && SKIP_INPUT_TYPES.has(type.value.trim().toLowerCase())) continue;

    const insideLabel = el.ancestors.some(
      (a) => a.type === "JSXElement" && elementName(a.openingElement as Node) === "label",
    );
    if (
      insideLabel ||
      el.attrs.map.has("aria-labelledby") ||
      attrIsPresent(el.attrs, "aria-label") ||
      attrIsPresent(el.attrs, "title")
    ) {
      continue;
    }

    const id = el.attrs.map.get("id");
    if (id?.kind === "static" && staticFor.has(id.value.trim())) continue;
    if (id?.kind === "dynamic" && dynamicFor.has(id.source.trim())) continue;

    if (id && (id.kind === "dynamic" || id.value.trim())) {
      // The label may be rendered by another component with the same id.
      ctx.add(el.opening, "form-field-label-unverified", "moderate", ["1.3.1", "3.3.2"],
        "Zum id des Feldes gibt es in dieser Datei kein <label htmlFor> mit demselben Wert.",
        "Prüfe, ob ein sichtbares Label mit passendem htmlFor gerendert wird.");
      continue;
    }

    const placeholderHint = el.attrs.map.has("placeholder") ? " Ein placeholder ersetzt kein Label." : "";
    ctx.add(el.opening, "form-field-label", "critical", ["1.3.1", "3.3.2", "4.1.2"],
      `Das Formularfeld hat keine Beschriftung.${placeholderHint}`,
      "Sichtbares <label htmlFor={id}> mit <input id={id}> (id z. B. aus useId()), oder das Feld in <label> einschließen.");
  }
}

function ruleNames(ctx: FileContext, elements: Element[]): void {
  for (const el of elements) {
    const role = el.attrs.map.get("role");
    const roleValue = role?.kind === "static" ? role.value.trim().toLowerCase() : "";
    const isButton = el.name === "button" || (isIntrinsic(el.name) && roleValue === "button");
    const isLink = el.name === "a" || ctx.linkComponents.has(el.name);

    if (!isButton && !isLink) continue;
    const result = accessibleName(ctx, el);
    const rule = isButton ? "button-name" : "link-name";
    if (result === "unknown") ctx.unknown(el.opening, rule);
    if (result !== "empty") continue;

    if (isButton) {
      ctx.add(el.opening, "button-name", "critical", ["4.1.2"],
        "Der Button hat keinen zugänglichen Namen.",
        "Sichtbaren Text in den Button schreiben. Nur Icon: aria-label mit dem Zweck (z. B. \"Menü öffnen\").");
    } else {
      ctx.add(el.opening, "link-name", "serious", ["2.4.4", "4.1.2"],
        "Der Link hat keinen zugänglichen Namen.",
        "Linktext ergänzen; bei einem Bild-Link beschreibt das alt des Bildes das Linkziel.");
    }
  }
}

function ruleFrames(ctx: FileContext, elements: Element[]): void {
  for (const el of elements) {
    if (el.name !== "iframe" || el.attrs.hasSpread) continue;
    if (!attrIsPresent(el.attrs, "title")) {
      ctx.add(el.opening, "frame-title", "serious", ["4.1.2"],
        "Der iframe hat kein title-Attribut.",
        'title="Kurze Beschreibung des Inhalts" ergänzen.');
    }
  }
}

function ruleMedia(ctx: FileContext, elements: Element[]): void {
  for (const el of elements) {
    if (el.name !== "video" && el.name !== "audio") continue;
    const autoplay = attrIsTrue(el.attrs, "autoplay");
    if (autoplay === true) {
      ctx.add(el.opening, "media-autoplay", "serious", ["1.4.2", "2.2.2"],
        `<${el.name}> startet automatisch (SPEC F1/N3 verbieten Autoplay).`,
        "autoPlay entfernen; das Medium erst nach Klick auf Play laden und starten.");
    } else if (autoplay === null) {
      ctx.unknown(el.opening, "media-autoplay");
    }
    if (el.name === "video" && !el.attrs.hasSpread) {
      let hasCaptions = false;
      let unknownChildren = false;
      walk(el.node.children, (child) => {
        if (child.type === "JSXExpressionContainer") unknownChildren = true;
        if (child.type !== "JSXElement") return;
        const name = elementName(child.openingElement as Node);
        if (name !== "track" && !isIntrinsic(name)) unknownChildren = true;
        if (name !== "track") return;
        const kind = readAttrs(ctx.file, child.openingElement as Node).map.get("kind");
        if (!kind || kind.kind === "dynamic" || ["captions", "subtitles"].includes(kind.value)) {
          hasCaptions = true;
        }
      });
      if (!hasCaptions && unknownChildren) ctx.unknown(el.opening, "video-captions");
      else if (!hasCaptions) {
        ctx.add(el.opening, "video-captions", "moderate", ["1.2.2"],
          "Das Video hat keine Untertitel-Spur.",
          'Bei gesprochenem Inhalt <track kind="captions" srcLang="de" src="…"> ergänzen.');
      }
    }
  }
}

function ruleInteractions(ctx: FileContext, elements: Element[]): void {
  for (const el of elements) {
    if (!STATIC_TAGS.has(el.name)) continue;
    if (!el.attrs.map.has("onclick")) continue;
    const role = el.attrs.map.get("role");
    if (role?.kind === "dynamic" || el.attrs.hasSpread) {
      ctx.unknown(el.opening, "no-static-element-interactions");
      continue;
    }
    const roleValue = role?.kind === "static" ? role.value.trim().toLowerCase() : "";
    if (!WIDGET_ROLES.has(roleValue)) {
      ctx.add(el.opening, "no-static-element-interactions", "serious", ["2.1.1", "4.1.2"],
        `<${el.name}> mit onClick ist nicht per Tastatur bedienbar.`,
        "Ein echtes <button type=\"button\"> (oder <a href> für Navigation) verwenden.");
      continue;
    }
    if (!el.attrs.map.has("tabindex")) {
      ctx.add(el.opening, "interactive-supports-focus", "serious", ["2.1.1"],
        `<${el.name} role="${roleValue}"> ist ohne tabIndex nicht per Tastatur erreichbar.`,
        "Besser ein echtes <button> verwenden; sonst tabIndex={0} ergänzen.");
    } else if (!["onkeydown", "onkeyup", "onkeypress"].some((k) => el.attrs.map.has(k))) {
      ctx.add(el.opening, "interactive-supports-keyboard", "moderate", ["2.1.1"],
        `<${el.name} role="${roleValue}"> reagiert nicht auf Enter/Leertaste.`,
        "Besser ein echtes <button> verwenden; sonst onKeyDown für Enter und Leertaste ergänzen.");
    }
  }
}

function ruleTabIndex(ctx: FileContext, elements: Element[]): void {
  for (const el of elements) {
    const tabIndex = el.attrs.map.get("tabindex");
    if (tabIndex?.kind !== "static") continue;
    const value = Number.parseInt(tabIndex.value, 10);
    if (!Number.isNaN(value) && value > 0) {
      ctx.add(el.opening, "tabindex-positive", "serious", ["2.4.3"],
        `tabIndex={${value}} verändert die Fokusreihenfolge.`,
        "tabIndex entfernen oder 0 bzw. -1 verwenden; die Reihenfolge ergibt sich aus dem DOM.");
    }
  }
}

function ruleHtmlLang(ctx: FileContext, elements: Element[]): void {
  for (const el of elements) {
    if (el.name !== "html" || el.attrs.hasSpread) continue;
    if (!attrIsPresent(el.attrs, "lang")) {
      ctx.add(el.opening, "html-lang", "serious", ["3.1.1"],
        "Das <html>-Element hat kein lang-Attribut.",
        'lang="de" ergänzen.');
    }
  }
}

function ruleTables(ctx: FileContext, elements: Element[]): void {
  for (const el of elements) {
    if (el.name !== "table") continue;
    const role = el.attrs.map.get("role");
    if (role?.kind === "static" && ["presentation", "none"].includes(role.value)) continue;
    let hasTd = false;
    let hasTh = false;
    let hasComponents = false;
    walk(el.node.children, (child) => {
      if (child.type !== "JSXElement") return;
      const name = elementName(child.openingElement as Node);
      if (name === "td") hasTd = true;
      if (name === "th") hasTh = true;
      if (!isIntrinsic(name)) hasComponents = true;
    });
    if (hasTd && !hasTh && !hasComponents) {
      ctx.add(el.opening, "table-headers", "moderate", ["1.3.1"],
        "Die Tabelle hat Datenzellen, aber keine Kopfzellen.",
        'Spalten- oder Zeilenköpfe mit <th scope="col"> bzw. <th scope="row"> auszeichnen.');
    }
  }
}

function ruleAria(ctx: FileContext, elements: Element[]): void {
  const staticIds = new Map<string, Node[]>();
  let hasDynamicIds = false;
  const hasComponents = elements.some((el) => !isIntrinsic(el.name));
  for (const el of elements) {
    const id = el.attrs.map.get("id");
    if (id?.kind === "dynamic") hasDynamicIds = true;
    if (id?.kind === "static" && id.value.trim()) {
      const list = staticIds.get(id.value.trim()) ?? [];
      list.push(el.opening);
      staticIds.set(id.value.trim(), list);
    }
  }

  for (const [id, nodes] of staticIds) {
    if (nodes.length > 1) {
      ctx.add(nodes[1], "duplicate-id", "moderate", ["4.1.2"],
        `id="${id}" kommt in dieser Datei ${nodes.length}-mal vor.`,
        "Jede id nur einmal vergeben, z. B. mit useId().");
    }
  }

  for (const el of elements) {
    const role = el.attrs.map.get("role");
    if (role?.kind === "static") {
      for (const value of role.value.trim().split(/\s+/)) {
        if (value && !VALID_ROLES.has(value.toLowerCase()) && !value.startsWith("doc-")) {
          ctx.add(el.opening, "aria-role", "serious", ["4.1.2"],
            `role="${value}" ist keine gültige ARIA-Rolle.`,
            "Rolle entfernen oder eine gültige WAI-ARIA-Rolle verwenden; besser ein passendes HTML-Element.");
        }
      }
    }

    const labelledBy = el.attrs.map.get("aria-labelledby");
    if (labelledBy?.kind === "static") {
      const missing = labelledBy.value.trim().split(/\s+/).filter((id) => id && !staticIds.has(id));
      if (missing.length && (hasDynamicIds || hasComponents)) {
        // The id may be rendered by a component or computed at runtime.
        ctx.unknown(el.opening, "aria-labelledby-target");
      } else if (missing.length) {
        ctx.add(el.opening, "aria-labelledby-target", "serious", ["4.1.2"],
          `aria-labelledby verweist auf nicht vorhandene id: ${missing.join(", ")}.`,
          "Auf ein vorhandenes Element mit sichtbarem Text verweisen oder sichtbaren Text verwenden.");
      }
    }

    const focusable =
      el.name === "button" ||
      el.name === "input" ||
      el.name === "select" ||
      el.name === "textarea" ||
      (el.name === "a" && el.attrs.map.has("href")) ||
      ctx.linkComponents.has(el.name);
    if (focusable && attrIsTrue(el.attrs, "aria-hidden") === true) {
      const tabIndex = el.attrs.map.get("tabindex");
      if (!(tabIndex?.kind === "static" && tabIndex.value.trim() === "-1")) {
        ctx.add(el.opening, "aria-hidden-focus", "serious", ["4.1.2"],
          `<${el.name} aria-hidden="true"> ist weiterhin per Tastatur erreichbar.`,
          "aria-hidden entfernen oder das Element mit tabIndex={-1} bzw. inert aus der Fokusreihenfolge nehmen.");
      }
    }
  }
}

const RULES = [
  ruleImages,
  ruleFormLabels,
  ruleNames,
  ruleFrames,
  ruleMedia,
  ruleInteractions,
  ruleTabIndex,
  ruleHtmlLang,
  ruleTables,
  ruleAria,
];

function auditParsedFile(file: ParsedFile, notCheckable: NotCheckable[]): Issue[] {
  const imports = collectImports(file.ast);
  const imageComponents = namesBoundTo(imports, "next/image");
  const linkComponents = namesBoundTo(imports, "next/link");
  const issues: Issue[] = [];
  const ctx: FileContext = {
    file,
    issues,
    notCheckable,
    text: { file, imageComponents },
    linkComponents,
    imageComponents,
    add(node, rule, severity, wcag, message, fix) {
      issues.push({ file: file.relPath, line: lineOf(node), rule, severity, wcag, message, fix });
    },
    unknown(node, rule) {
      notCheckable.push({ file: file.relPath, line: lineOf(node), rule });
    },
  };
  const elements = collectElements(file);
  for (const rule of RULES) rule(ctx, elements);
  return issues;
}

async function auditAccessibility(rootDir: string, target: string): Promise<AccessibilityReport> {
  const blocking = "critical, serious";
  const resolved = await resolveTarget(rootDir, target);
  if (resolved.error) {
    return { tool: "accessibility_audit", standard: "WCAG 2.2 AA", status: "error", blocking, error: resolved.error };
  }

  const issues: Issue[] = [];
  const notCheckable: NotCheckable[] = [];
  let audited = 0;
  let skipped = 0;
  for (const absPath of resolved.files) {
    const parsed = await parseFile(absPath, resolved.root);
    if (!parsed) {
      skipped++;
      continue;
    }
    audited++;
    issues.push(...auditParsedFile(parsed, notCheckable));
  }

  const sorted = sortIssues(issues);
  const failed = sorted.some((issue) => BLOCKING_SEVERITIES.includes(issue.severity));
  return {
    tool: "accessibility_audit",
    standard: "WCAG 2.2 AA",
    status: failed ? "failed" : "passed",
    blocking,
    summary: {
      filesAudited: audited,
      filesSkipped: skipped,
      bySeverity: countBySeverity(sorted),
      byRule: countByRule(sorted),
      notCheckable: notCheckable.length,
    },
    issues: sorted,
    notCheckable: { byRule: countByRule(notCheckable), examples: notCheckable.slice(0, 10) },
    manualReview: MANUAL_REVIEW,
  };
}

// ═══════════════════════════════════════════════ Tool

export default tool({
  description:
    "Statischer Accessibility-Audit (WCAG 2.2 A/AA) für React-/Next.js-Quellcode (TSX/JSX). " +
    "Prüft u. a. alt-Texte, Formular-Labels, Namen von Links und Buttons, Autoplay, Untertitel, ARIA-Rollen, " +
    "Tastaturbedienbarkeit von onClick-Elementen und lang am <html>. Testdateien werden übersprungen. " +
    "Dynamische Werte ({sport.name}, useId(), Props) zählen als vorhanden und stehen unter notCheckable. " +
    "status 'passed' = keine critical- oder serious-Befunde. Jeder Befund nennt Datei, Zeile und Fix.",
  args: {
    target: tool.schema
      .string()
      .describe('Datei oder Verzeichnis im Projekt, z. B. "app" oder "app/components/TopBar.tsx".'),
  },
  async execute(args, context) {
    try {
      const root = context.worktree || context.directory;
      return JSON.stringify(await auditAccessibility(root, args.target));
    } catch (error) {
      return JSON.stringify({
        tool: "accessibility_audit",
        status: "error",
        blocking: "",
        error: { code: "AUDIT_FAILED", message: error instanceof Error ? error.message : String(error) },
      });
    }
  },
});
