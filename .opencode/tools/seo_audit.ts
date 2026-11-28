/// <reference types="node" />

// Static SEO audit for Next.js App Router pages.
//
// OpenCode tool. The agent calls it while implementing; `npm run verify`
// calls the same tool in every full attempt.
//
// Audits every page.tsx/.ts/.jsx/.js below the target. Headings, links and
// JSX meta tags are also read from the project files the page imports
// ("@/…" or relative, up to 4 levels deep), so the H1 in the view counts for
// the page. Test files are never audited.
//
// Checked:
//   Metadata (export const metadata, generateMetadata, JSX <title>/<meta>):
//     title, description (+ length), alternates.canonical, robots,
//     Open Graph / Twitter (inherited from layout.tsx counts), duplicates
//   Headings: H1 present, several H1, empty headings, skipped levels
//   Links: missing/empty href, placeholder "#"
//   JSON-LD: valid JSON, @context, @type
//
// Values that cannot be evaluated statically (title: sport.name,
// canonical: `/${slug}`, <h1>{sport.name}</h1>, href={sponsor.url}) count as
// present and are listed under "notCheckable".
//
// Not covered: real indexing, robots.txt, sitemap.xml, HTTP headers,
// Core Web Vitals (see npm run perf), rendering by Googlebot.
//
// Blocking: critical, serious and moderate findings. minor findings do not block.
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


const BLOCKING_SEVERITIES: Severity[] = ["critical", "serious", "moderate"];
const MAX_IMPORT_DEPTH = 4;

interface SeoReport {
  tool: "seo_audit";
  status: "passed" | "failed" | "no-pages-found" | "error";
  blocking: string;
  summary?: {
    pagesAudited: number;
    filesRead: number;
    bySeverity: Record<Severity, number>;
    byRule: Record<string, number>;
    notCheckable: number;
  };
  issues?: Issue[];
  notCheckable?: { byRule: Record<string, number>; examples: NotCheckable[] };
  error?: { code: string; message: string };
}

interface PageContext {
  page: ParsedFile;
  issues: Issue[];
  notCheckable: NotCheckable[];
  add(file: ParsedFile, node: Node | null, rule: string, severity: Severity, message: string, fix: string): void;
  unknown(file: ParsedFile, node: Node | null, rule: string): void;
}

// ───────────────────────────────────────────────────────── Metadata

interface MetadataInfo {
  /** "absent": no metadata export; "unknown": generateMetadata without a readable object. */
  state: "static" | "unknown" | "absent";
  value: StaticValue;
  node: Node | null;
}

function functionReturnObjects(fn: Node): Node[] {
  const objects: Node[] = [];
  const body = fn.body as Node | undefined;
  if (!body) return objects;
  const unwrap = (n: Node): Node =>
    n.type === "TSAsExpression" || n.type === "TSSatisfiesExpression" ? unwrap(n.expression as Node) : n;
  if (body.type !== "BlockStatement") {
    const expr = unwrap(body);
    if (expr.type === "ObjectExpression") objects.push(expr);
    return objects;
  }
  walk(body, (node) => {
    if (node.type === "ReturnStatement" && node.argument) {
      const expr = unwrap(node.argument as Node);
      if (expr.type === "ObjectExpression") objects.push(expr);
    }
  });
  return objects;
}

function readMetadata(file: ParsedFile): MetadataInfo {
  const body = (file.ast.body as Node[]) ?? [];
  const declarations: Node[] = [];
  for (const statement of body) {
    const decl = statement.type === "ExportNamedDeclaration" ? (statement.declaration as Node | null) : statement;
    if (decl) declarations.push(decl);
  }

  for (const decl of declarations) {
    if (decl.type === "VariableDeclaration") {
      for (const d of (decl.declarations as Node[]) ?? []) {
        const name = String((d.id as Node)?.name ?? "");
        const init = d.init as Node | null;
        if (name === "metadata" && init) return { state: "static", value: evaluate(init), node: d };
        if (name === "generateMetadata" && init &&
          (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")) {
          return fromFunction(init, d);
        }
      }
    }
    if (decl.type === "FunctionDeclaration" && String((decl.id as Node)?.name ?? "") === "generateMetadata") {
      return fromFunction(decl, decl);
    }
  }
  return { state: "absent", value: { kind: "dynamic" }, node: null };
}

function fromFunction(fn: Node, node: Node): MetadataInfo {
  const objects = functionReturnObjects(fn).map((o) => evaluate(o));
  if (!objects.length) return { state: "unknown", value: { kind: "dynamic" }, node };
  // Early returns (e.g. "not found") usually have fewer fields: use the richest object.
  objects.sort((a, b) =>
    (b.kind === "object" ? b.props.size : 0) - (a.kind === "object" ? a.props.size : 0));
  return { state: "static", value: objects[0], node };
}

/** Title may be a string or { default, absolute, template }. */
function titleValue(meta: StaticValue): StaticValue | "absent" {
  const title = getProp(meta, ["title"]);
  if (title === "absent" || title.kind !== "object") return title;
  for (const key of ["absolute", "default"]) {
    const inner = getProp(title, [key]);
    if (inner !== "absent") return inner;
  }
  return title.hasSpread ? { kind: "dynamic" } : "absent";
}

/** true if the page or one of its layouts (up to the project root) sets the key. */
async function hasInheritedSocial(page: ParsedFile, root: string, key: string): Promise<boolean> {
  let dir = path.dirname(page.absPath);
  while (dir === root || dir.startsWith(root + path.sep)) {
    for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
      const parsed = await parseFile(path.join(dir, `layout${ext}`), root);
      if (!parsed) continue;
      const meta = readMetadata(parsed);
      if (meta.state === "unknown") return true;
      if (meta.state === "static" && getProp(meta.value, [key]) !== "absent") return true;
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  return false;
}

// ──────────────────────────────────────────────────── JSX collection

interface Collected {
  file: ParsedFile;
  node: Node;
  name: string;
  imageComponents: Set<string>;
  linkComponents: Set<string>;
}

async function collectTree(page: ParsedFile, root: string): Promise<{ elements: Collected[]; files: number }> {
  const elements: Collected[] = [];
  const seen = new Set<string>();

  const visitFile = async (file: ParsedFile, depth: number): Promise<void> => {
    if (seen.has(file.absPath)) return;
    seen.add(file.absPath);
    const imports = collectImports(file.ast);
    const imageComponents = namesBoundTo(imports, "next/image");
    const linkComponents = namesBoundTo(imports, "next/link");
    walk(file.ast, (node) => {
      if (node.type !== "JSXElement") return;
      elements.push({
        file,
        node,
        name: elementName(node.openingElement as Node),
        imageComponents,
        linkComponents,
      });
    });
    if (depth >= MAX_IMPORT_DEPTH) return;
    for (const binding of imports.values()) {
      const resolved = resolveImport(binding.source, file.absPath, root);
      if (!resolved) continue;
      const parsed = await parseFile(resolved, root);
      if (parsed) await visitFile(parsed, depth + 1);
    }
  };

  await visitFile(page, 0);
  return { elements, files: seen.size };
}

// ─────────────────────────────────────────────────────────── Checks

async function auditPage(page: ParsedFile, root: string, ctx: PageContext): Promise<number> {
  const meta = readMetadata(page);
  const { elements, files } = await collectTree(page, root);

  // JSX metadata (React 19 hoists <title> and <meta> into <head>).
  const jsxTitles: Collected[] = [];
  const jsxDescriptions: { el: Collected; value: string | null }[] = [];
  const jsxCanonicals: { el: Collected; value: string | null }[] = [];
  for (const el of elements) {
    const attrs = readAttrs(el.file, el.node.openingElement as Node);
    const attr = (name: string): string | null => {
      const v = attrs.map.get(name);
      return v?.kind === "static" ? v.value : null;
    };
    if (el.name === "title") jsxTitles.push(el);
    if (el.name === "meta" && attr("name")?.toLowerCase() === "description") {
      jsxDescriptions.push({ el, value: attrs.map.get("content")?.kind === "dynamic" ? null : attr("content") ?? "" });
    }
    if (el.name === "meta" && attr("name")?.toLowerCase() === "robots") {
      const content = (attr("content") ?? "").toLowerCase();
      if (content.includes("noindex")) {
        ctx.add(el.file, el.node, "robots-noindex", "critical", "Die Seite enthält noindex.",
          "noindex entfernen, sofern die Seite in Suchmaschinen erscheinen soll.");
      }
      if (content.includes("nofollow")) {
        ctx.add(el.file, el.node, "robots-nofollow", "moderate", "Die Seite enthält nofollow.",
          "nofollow entfernen, sofern Suchmaschinen den Links folgen sollen.");
      }
    }
    if (el.name === "link" && attr("rel")?.toLowerCase() === "canonical") {
      jsxCanonicals.push({ el, value: attrs.map.get("href")?.kind === "dynamic" ? null : attr("href") ?? "" });
    }
  }

  const metaUnknown = meta.state === "unknown";
  if (metaUnknown) ctx.unknown(page, meta.node, "metadata");
  const metaValue = meta.state === "static" ? meta.value : null;

  // Title
  const title = metaValue ? titleValue(metaValue) : "absent";
  if (!metaUnknown && title === "absent" && !jsxTitles.length) {
    ctx.add(page, meta.node, "title-missing", "serious", "Kein Seitentitel gefunden.",
      'In page.tsx export const metadata = { title: "…", … } ergänzen (AGENTS.md, SEO).');
  } else if (title !== "absent" && title.kind === "string" && !title.value.trim()) {
    ctx.add(page, meta.node, "title-empty", "serious", "Der Seitentitel ist leer.", "Aussagekräftigen Titel eintragen.");
  } else if (title !== "absent" && title.kind === "dynamic") {
    ctx.unknown(page, meta.node, "title");
  }

  // Description
  const description = metaValue ? getProp(metaValue, ["description"]) : "absent";
  const descriptionCount = (description === "absent" ? 0 : 1) + jsxDescriptions.length;
  if (!metaUnknown && descriptionCount === 0) {
    ctx.add(page, meta.node, "meta-description-missing", "serious", "Keine Meta Description gefunden.",
      "description (ca. 70–160 Zeichen) im metadata-Export ergänzen.");
  }
  const descriptionTexts: (string | null)[] = jsxDescriptions.map((d) => d.value);
  if (description !== "absent") {
    descriptionTexts.push(description.kind === "string" ? description.value : null);
    if (description.kind === "dynamic") ctx.unknown(page, meta.node, "meta-description");
  }
  for (const text of descriptionTexts) {
    if (text === null) continue;
    const length = text.trim().length;
    if (!length) {
      ctx.add(page, meta.node, "meta-description-empty", "serious", "Die Meta Description ist leer.",
        "Aussagekräftige Beschreibung eintragen.");
    } else if (length < 70 || length > 160) {
      ctx.add(page, meta.node, "meta-description-length", "minor",
        `Die Meta Description hat ${length} Zeichen (empfohlen 70–160).`,
        "Beschreibung kürzen oder ergänzen.");
    }
  }
  if (descriptionCount > 1) {
    ctx.add(page, meta.node, "duplicate-metadata", "moderate", "Die Meta Description ist mehrfach gesetzt.",
      "Nur den metadata-Export verwenden.");
  }

  // Canonical
  const canonical = metaValue ? getProp(metaValue, ["alternates", "canonical"]) : "absent";
  if (!metaUnknown && canonical === "absent" && !jsxCanonicals.length) {
    ctx.add(page, meta.node, "canonical-missing", "moderate", "Keine Canonical-URL gefunden.",
      'alternates: { canonical: "/pfad" } im metadata-Export ergänzen (AGENTS.md, SEO).');
  }
  const canonicalTexts: (string | null)[] = jsxCanonicals.map((c) => c.value);
  if (canonical !== "absent") {
    canonicalTexts.push(canonical.kind === "string" ? canonical.value : null);
    if (canonical.kind === "dynamic") ctx.unknown(page, meta.node, "canonical");
  }
  if (canonicalTexts.some((text) => text !== null && !text.trim())) {
    ctx.add(page, meta.node, "canonical-empty", "serious", "Die Canonical-URL ist leer.",
      'Relativen Pfad der Seite eintragen, z. B. "/fussball".');
  }
  if (canonical !== "absent" && jsxCanonicals.length) {
    ctx.add(page, meta.node, "duplicate-metadata", "moderate", "Die Canonical-URL ist mehrfach gesetzt.",
      "Nur alternates.canonical im metadata-Export verwenden.");
  }

  // Robots in metadata
  const robots = metaValue ? getProp(metaValue, ["robots"]) : "absent";
  if (robots !== "absent") {
    const text = robots.kind === "string" ? robots.value.toLowerCase() : "";
    const isFalse = (key: string): boolean => {
      const v = getProp(robots, [key]);
      return v !== "absent" && v.kind === "boolean" && !v.value;
    };
    if (text.includes("noindex") || isFalse("index")) {
      ctx.add(page, meta.node, "robots-noindex", "critical", "Die Seite ist auf noindex gesetzt.",
        "robots-Angabe entfernen, sofern die Seite in Suchmaschinen erscheinen soll.");
    }
    if (text.includes("nofollow") || isFalse("follow")) {
      ctx.add(page, meta.node, "robots-nofollow", "moderate", "Die Seite ist auf nofollow gesetzt.",
        "nofollow entfernen, sofern Suchmaschinen den Links folgen sollen.");
    }
  }

  // Open Graph / Twitter (inherited from a layout counts)
  if (!metaUnknown) {
    const missing: string[] = [];
    for (const key of ["openGraph", "twitter"]) {
      const own = metaValue ? getProp(metaValue, [key]) : "absent";
      if (own === "absent" && !(await hasInheritedSocial(page, root, key))) missing.push(key);
    }
    if (missing.length) {
      ctx.add(page, meta.node, "social-metadata-missing", "minor",
        `Keine ${missing.join(" und ")}-Metadaten (auch nicht im Layout).`,
        "Optional: openGraph/twitter einmal in app/layout.tsx setzen, dann gelten sie für alle Seiten.");
    }
  }

  // Headings
  const headings = elements.filter((el) => /^h[1-6]$/.test(el.name));
  const h1 = headings.filter((el) => el.name === "h1");
  if (!h1.length) {
    ctx.add(page, null, "h1-missing", "moderate", "Keine H1-Überschrift auf der Seite (inkl. View und Komponenten).",
      "Genau eine <h1> mit dem Seitenthema in der View ergänzen.");
  } else if (h1.length > 1) {
    ctx.add(h1[1].file, h1[1].node, "multiple-h1", "minor", `${h1.length} H1-Überschriften gefunden.`,
      "Eine H1 pro Seite; weitere Überschriften als h2/h3.");
  }
  let previous = 0;
  for (const heading of headings) {
    const level = Number(heading.name.slice(1));
    const content = textContent(heading.node, { file: heading.file, imageComponents: heading.imageComponents });
    if (!content.text && content.unknown) ctx.unknown(heading.file, heading.node, "empty-heading");
    else if (!content.text) {
      ctx.add(heading.file, heading.node, "empty-heading", "moderate", "Die Überschrift ist leer.",
        "Text in die Überschrift schreiben oder das Element entfernen.");
    }
    if (previous && level > previous + 1) {
      ctx.add(heading.file, heading.node, "heading-level-skip", "minor",
        `Überschriftensprung von H${previous} zu H${level} (in Quelltext-Reihenfolge).`,
        "Überschriftenebenen ohne Lücke verwenden.");
    }
    previous = level;
  }

  // Links
  for (const el of elements) {
    if (el.name !== "a" && !el.linkComponents.has(el.name)) continue;
    const attrs = readAttrs(el.file, el.node.openingElement as Node);
    if (attrs.hasSpread) continue;
    const href = attrs.map.get("href");
    if (href?.kind === "dynamic") continue;
    if (!href || (href.kind === "static" && !href.value.trim()) || href.kind === "boolean") {
      ctx.add(el.file, el.node, "link-href-missing", "moderate", "Der Link hat kein href-Ziel.",
        "Gültiges Ziel eintragen; für Aktionen ohne Ziel ein <button> verwenden.");
    } else if (href.value.trim() === "#") {
      ctx.add(el.file, el.node, "link-placeholder", "minor", 'Der Link zeigt auf "#".',
        "Echtes Ziel eintragen oder ein <button> verwenden.");
    }
  }

  // JSON-LD
  for (const el of elements) {
    if (el.name !== "script") continue;
    const attrs = readAttrs(el.file, el.node.openingElement as Node);
    const type = attrs.map.get("type");
    if (type?.kind !== "static" || type.value !== "application/ld+json") continue;

    const inner = attrs.map.get("dangerouslysetinnerhtml");
    let data: unknown = undefined;
    let checked = false;
    if (inner) {
      const htmlProp = findInnerHtmlExpression(el.node);
      const stringified = htmlProp && htmlProp.type === "CallExpression" &&
        String(((htmlProp.callee as Node).property as Node)?.name ?? "") === "stringify"
        ? evaluate(((htmlProp.arguments as Node[]) ?? [])[0])
        : null;
      if (stringified && stringified.kind === "object" && !stringified.hasSpread) {
        checked = true;
        data = { "@context": stringified.props.has("@context") ? 1 : undefined, "@type": stringified.props.has("@type") ? 1 : undefined };
      } else if (htmlProp) {
        const raw = literalString(htmlProp);
        if (raw !== null) {
          checked = true;
          try {
            data = JSON.parse(raw);
          } catch {
            ctx.add(el.file, el.node, "jsonld-invalid", "serious", "JSON-LD ist kein gültiges JSON.", "JSON-Syntax korrigieren.");
            continue;
          }
        }
      }
    } else {
      const content = textContent(el.node, { file: el.file, imageComponents: new Set() });
      if (!content.unknown) {
        checked = true;
        try {
          data = JSON.parse(content.text);
        } catch {
          ctx.add(el.file, el.node, "jsonld-invalid", "serious", "JSON-LD ist kein gültiges JSON.", "JSON-Syntax korrigieren.");
          continue;
        }
      }
    }
    if (!checked) {
      ctx.unknown(el.file, el.node, "jsonld");
      continue;
    }
    for (const item of Array.isArray(data) ? data : [data]) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      if (!record["@context"]) {
        ctx.add(el.file, el.node, "jsonld-context-missing", "moderate", "JSON-LD enthält keinen @context.",
          '"@context": "https://schema.org" ergänzen.');
      }
      if (!record["@type"]) {
        ctx.add(el.file, el.node, "jsonld-type-missing", "moderate", "JSON-LD enthält keinen @type.",
          'Passenden Schema.org-Typ ergänzen, z. B. "SportsClub".');
      }
    }
  }

  return files;
}

function findInnerHtmlExpression(element: Node): Node | null {
  const opening = element.openingElement as Node;
  for (const attr of (opening.attributes as Node[]) ?? []) {
    if (attr.type !== "JSXAttribute" || String((attr.name as Node).name) !== "dangerouslySetInnerHTML") continue;
    const container = attr.value as Node | null;
    const object = container?.expression as Node | undefined;
    if (object?.type !== "ObjectExpression") return null;
    for (const prop of (object.properties as Node[]) ?? []) {
      if (prop.type === "Property" && String((prop.key as Node).name ?? (prop.key as Node).value) === "__html") {
        return prop.value as Node;
      }
    }
  }
  return null;
}

// ───────────────────────────────────────────────────────── Entry point

async function auditSeo(rootDir: string, target: string): Promise<SeoReport> {
  const blocking = "critical, serious, moderate";
  const resolved = await resolveTarget(rootDir, target);
  if (resolved.error) return { tool: "seo_audit", status: "error", blocking, error: resolved.error };

  const pages = resolved.files.filter((file) => isPageFile(file));
  if (resolved.files.length === 1 && !pages.length) {
    return {
      tool: "seo_audit",
      status: "error",
      blocking,
      error: { code: "NOT_A_PAGE", message: "seo_audit prüft Seiten: page.tsx oder ein Verzeichnis übergeben." },
    };
  }

  const issues: Issue[] = [];
  const notCheckable: NotCheckable[] = [];
  let filesRead = 0;
  let audited = 0;
  for (const absPath of pages) {
    const page = await parseFile(absPath, resolved.root);
    if (!page) continue;
    audited++;
    const ctx: PageContext = {
      page,
      issues,
      notCheckable,
      add(file, node, rule, severity, message, fix) {
        const where = file.absPath === page.absPath ? "" : ` (Seite ${page.relPath})`;
        issues.push({ file: file.relPath, line: lineOf(node), rule, severity, message: message + where, fix });
      },
      unknown(file, node, rule) {
        notCheckable.push({ file: file.relPath, line: lineOf(node), rule });
      },
    };
    filesRead += await auditPage(page, resolved.root, ctx);
  }

  // A component used by several pages would report the same problem once per page.
  const unique = new Map<string, Issue>();
  issues.forEach((issue, index) => {
    const key = issue.line === null ? `page-level:${index}` : `${issue.file}:${issue.line}:${issue.rule}`;
    if (!unique.has(key)) unique.set(key, issue);
  });
  const sorted = sortIssues([...unique.values()]);
  const failed = sorted.some((issue) => BLOCKING_SEVERITIES.includes(issue.severity));

  return {
    tool: "seo_audit",
    status: audited === 0 ? "no-pages-found" : failed ? "failed" : "passed",
    blocking,
    summary: {
      pagesAudited: audited,
      filesRead,
      bySeverity: countBySeverity(sorted),
      byRule: countByRule(sorted),
      notCheckable: notCheckable.length,
    },
    issues: sorted,
    notCheckable: { byRule: countByRule(notCheckable), examples: notCheckable.slice(0, 10) },
  };
}

// ═══════════════════════════════════════════════ Tool

export default tool({
  description:
    "Statischer SEO-Audit für Next.js-Seiten (page.tsx). Prüft title, description, " +
    "alternates.canonical, robots, Open Graph/Twitter (auch geerbt aus layout.tsx), H1 und " +
    "Überschriftenstruktur, Links und JSON-LD. Überschriften und Links werden auch aus den " +
    "importierten Views und Komponenten gelesen. Dynamische Werte zählen als vorhanden. " +
    "status 'passed' = keine critical-, serious- oder moderate-Befunde. Jeder Befund nennt Datei, Zeile und Fix.",
  args: {
    target: tool.schema
      .string()
      .describe('Verzeichnis oder page.tsx im Projekt, z. B. "app" oder "app/(routes)/fussball/page.tsx".'),
  },
  async execute(args, context) {
    try {
      const root = context.worktree || context.directory;
      return JSON.stringify(await auditSeo(root, args.target));
    } catch (error) {
      return JSON.stringify({
        tool: "seo_audit",
        status: "error",
        blocking: "",
        error: { code: "AUDIT_FAILED", message: error instanceof Error ? error.message : String(error) },
      });
    }
  },
});
