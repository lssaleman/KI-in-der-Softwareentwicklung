/// <reference types="node" />

import { tool } from "@opencode-ai/plugin";
import { readFile, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { parse as parseTSX } from "@typescript-eslint/parser";

// ─────────────────────────────────────────────────────────────── Types

type Severity = "critical" | "serious" | "moderate" | "minor";

type Issue = {
  file: string;
  line: number | null;
  column: number | null;
  rule: string;
  wcag: string[];
  severity: Severity;
  element: string;
  message: string;
  suggestion: string;
};

// ─────────────────────────────────────────── AST node helpers (TSX)

type ASTNode = Record<string, unknown> & {
  type: string;
  loc?: { start: { line: number; column: number } };
};

/** Iterates every node in an ESTree-compatible AST depth-first. */
function* walkAST(node: unknown): Generator<ASTNode> {
  if (!node || typeof node !== "object") return;
  const n = node as ASTNode;
  if (typeof n.type === "string") yield n;
  for (const key of Object.keys(n)) {
    const child = n[key];
    if (Array.isArray(child)) {
      for (const item of child) yield* walkAST(item);
    } else if (child && typeof child === "object") {
      yield* walkAST(child);
    }
  }
}

/** Returns the string value of a JSXAttribute, or null when dynamic/absent. */
function jsxAttrValue(attr: ASTNode): string | null {
  const val = attr.value as ASTNode | null;
  if (!val) return "";                          // boolean prop, e.g. required
  if (val.type === "Literal") return String(val.value ?? "");
  if (val.type === "JSXExpressionContainer") {
    const expr = val.expression as ASTNode;
    if (expr.type === "Literal") return String(expr.value ?? "");
    if (expr.type === "TemplateLiteral") {
      // Static template literal with no expressions
      const quasis = expr.quasis as ASTNode[];
      if (
        quasis.length === 1 &&
        (expr.expressions as unknown[]).length === 0
      ) {
        return String((quasis[0].value as Record<string, string>).cooked ?? "");
      }
    }
    return null; // dynamic — can't evaluate statically
  }
  return null;
}

/** Returns all JSXAttributes of a JSXOpeningElement keyed by name. */
function attrMap(
  opening: ASTNode,
): Map<string, { value: string | null; node: ASTNode }> {
  const map = new Map<string, { value: string | null; node: ASTNode }>();
  for (const attr of (opening.attributes as ASTNode[]) ?? []) {
    if (attr.type === "JSXAttribute") {
      const name = (attr.name as ASTNode).name as string;
      map.set(name.toLowerCase(), { value: jsxAttrValue(attr), node: attr });
    } else if (attr.type === "JSXSpreadAttribute") {
      // Spread props — we can't know what's inside statically
      map.set("__spread__", { value: null, node: attr });
    }
  }
  return map;
}

/** Returns true when a spread attribute is present (hides known attrs). */
function hasSpread(attrs: Map<string, { value: string | null; node: ASTNode }>) {
  return attrs.has("__spread__");
}

/** Returns the tag name of a JSXOpeningElement as lowercase string, or null for member expressions. */
function tagName(opening: ASTNode): string | null {
  const nameNode = opening.name as ASTNode;
  if (nameNode.type === "JSXIdentifier") return (nameNode.name as string).toLowerCase();
  // JSXMemberExpression (e.g. <Next.Image>) — handled separately
  return null;
}

/** Extracts JSX text content from a JSXElement's children. */
function jsxTextContent(element: ASTNode): string {
  let result = "";
  for (const child of (element.children as ASTNode[]) ?? []) {
    if (child.type === "JSXText") {
      result += " " + (child.value as string ?? "");
    } else if (child.type === "JSXElement") {
      result += " " + jsxTextContent(child);
    } else if (child.type === "JSXExpressionContainer") {
      const expr = child.expression as ASTNode;
      if (expr.type === "Literal") result += " " + String(expr.value ?? "");
    }
  }
  return result.replace(/\s+/g, " ").trim();
}

/**
 * Returns a best-effort accessible name for a JSXElement:
 *   aria-label > aria-labelledby (presence only) > title > text content
 * Returns null when a spread makes it unknowable.
 */
function accessibleName(
  element: ASTNode,
  attrs: Map<string, { value: string | null; node: ASTNode }>,
): string | null {
  if (hasSpread(attrs)) return null;

  const ariaLabel = attrs.get("aria-label");
  if (ariaLabel) {
    return ariaLabel.value ?? null; // dynamic → null
  }

  const labelledBy = attrs.get("aria-labelledby");
  if (labelledBy) return labelledBy.value ?? "ref"; // presence is enough here

  const title = attrs.get("title");
  if (title?.value?.trim()) return title.value;

  return jsxTextContent(element) || null;
}

/** Returns the JSXOpeningElement from a JSXElement. */
function opening(element: ASTNode): ASTNode {
  return element.openingElement as ASTNode;
}

// ──────────────────────────────────────── Known component name maps

/** Component names from common libraries that render <img> semantically. */
const IMAGE_COMPONENTS = new Set([
  "image",   // next/image, chakra Image, MUI Box used as img, etc.
  "avatar",
  "thumbnail",
]);

/** Component names that render as interactive elements. */
const INTERACTIVE_COMPONENTS = new Set([
  "button",
  "link",
  "pressable",
  "touchableopacity",
  "touchablehighlight",
  "clickable",
  "iconbutton",
  "menuitem",
  "menubutton",
]);

// ─────────────────────────────────────────────────── Rule runners

type RuleContext = {
  filePath: string;   // relative to project root
  source: string;
  issues: Issue[];
  add(
    node: ASTNode,
    rule: string,
    wcag: string[],
    severity: Severity,
    element: string,
    message: string,
    suggestion: string,
  ): void;
};

function makeContext(filePath: string, source: string): RuleContext {
  const issues: Issue[] = [];
  return {
    filePath,
    source,
    issues,
    add(node, rule, wcag, severity, element, message, suggestion) {
      issues.push({
        file: filePath,
        line: node.loc?.start.line ?? null,
        column: node.loc?.start.column != null ? node.loc.start.column + 1 : null,
        rule,
        wcag,
        severity,
        element,
        message,
        suggestion,
      });
    },
  };
}

// ── Rule: img elements and known image components missing alt

function ruleImageAlt(ctx: RuleContext, ast: ASTNode): void {
  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    const tag = tagName(op);
    const attrs = attrMap(op);

    const isImgTag = tag === "img";
    const isNextImage = (() => {
      const name = op.name as ASTNode;
      if (name.type === "JSXMemberExpression") {
        const prop = (name.property as ASTNode).name as string;
        return prop?.toLowerCase() === "image";
      }
      return false;
    })();
    const isImageComponent =
      tag !== null && IMAGE_COMPONENTS.has(tag) && /^[A-Z]/.test(
        ((op.name as ASTNode).name as string) ?? "",
      );

    if (!isImgTag && !isNextImage && !isImageComponent) continue;
    if (hasSpread(attrs)) continue; // might have alt via spread

    const alt = attrs.get("alt");

    if (alt === undefined) {
      ctx.add(
        op,
        "image-alt",
        ["1.1.1"],
        "critical",
        tag ?? "Image",
        "Das Bild hat kein alt-Prop.",
        "Ergänze alt=\"Beschreibung\" oder alt=\"\" für rein dekorative Bilder.",
      );
    } else if (
      alt.value !== null &&
      /^(image|foto|grafik|bild|icon|img|picture|\s*)$/i.test(alt.value.trim())
    ) {
      ctx.add(
        op,
        "image-alt-meaningful",
        ["1.1.1"],
        "serious",
        tag ?? "Image",
        `Das alt-Attribut "${alt.value}" ist möglicherweise nicht aussagekräftig.`,
        "Beschreibe den Inhalt oder Zweck des Bildes statt nur seinen Typ.",
      );
    }
  }
}

// ── Rule: form inputs without labels

function ruleFormLabels(ctx: RuleContext, ast: ASTNode): void {
  const SKIP_TYPES = new Set([
    "hidden", "submit", "button", "reset",
  ]);

  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    const tag = tagName(op);
    if (!tag || !["input", "select", "textarea"].includes(tag)) continue;

    const attrs = attrMap(op);
    if (hasSpread(attrs)) continue;

    const type = attrs.get("type")?.value?.toLowerCase() ?? "text";
    if (SKIP_TYPES.has(type)) continue;

    const hasAriaLabel = !!attrs.get("aria-label")?.value?.trim();
    const hasAriaLabelledby = attrs.get("aria-labelledby") !== undefined;
    const hasId = !!attrs.get("id")?.value?.trim();
    // htmlFor matching is cross-node — we check presence conservatively
    const hasTitle = !!attrs.get("title")?.value?.trim();
    const hasPlaceholderOnly =
      attrs.get("placeholder") !== undefined &&
      !hasAriaLabel &&
      !hasAriaLabelledby &&
      !hasId &&
      !hasTitle;

    if (!hasAriaLabel && !hasAriaLabelledby && !hasId && !hasTitle) {
      ctx.add(
        op,
        "form-field-label",
        ["1.3.1", "3.3.2", "4.1.2"],
        "critical",
        tag,
        "Das Eingabefeld hat kein erkennbares Label.",
        "Verknüpfe ein <label htmlFor=\"…\"> oder ergänze aria-label bzw. aria-labelledby.",
      );
    } else if (hasPlaceholderOnly) {
      ctx.add(
        op,
        "placeholder-not-label",
        ["1.3.1", "3.3.2"],
        "serious",
        tag,
        "placeholder ersetzt kein zugängliches Label.",
        "Ergänze zusätzlich ein sichtbares label-Element oder aria-label.",
      );
    }
  }
}

// ── Rule: buttons without accessible name

function ruleButtonName(ctx: RuleContext, ast: ASTNode): void {
  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    const tag = tagName(op);

    const isButton = tag === "button";
    const isButtonComponent =
      tag !== null &&
      INTERACTIVE_COMPONENTS.has(tag) &&
      /^[A-Z]/.test(((op.name as ASTNode).name as string) ?? "");

    if (!isButton && !isButtonComponent) continue;

    const attrs = attrMap(op);
    if (hasSpread(attrs)) continue;

    const name = accessibleName(node, attrs);
    if (!name?.trim()) {
      ctx.add(
        op,
        "button-name",
        ["4.1.2"],
        "critical",
        tag ?? "Button",
        "Der Button hat keinen erkennbaren zugänglichen Namen.",
        "Füge sichtbaren Buttontext, aria-label oder aria-labelledby hinzu.",
      );
    }
  }
}

// ── Rule: links without accessible name

function ruleLinkName(ctx: RuleContext, ast: ASTNode): void {
  const LINK_TAGS = new Set(["a", "link"]);
  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    const tag = tagName(op);
    if (!tag || !LINK_TAGS.has(tag)) continue;

    const attrs = attrMap(op);
    if (hasSpread(attrs)) continue;

    const name = accessibleName(node, attrs);
    if (!name?.trim()) {
      ctx.add(
        op,
        "link-name",
        ["2.4.4", "4.1.2"],
        "serious",
        tag,
        "Der Link hat keinen erkennbaren zugänglichen Namen.",
        "Füge beschreibenden Linktext, aria-label oder ein Bild mit alt hinzu.",
      );
    }
  }
}

// ── Rule: iframes without title

function ruleFrameTitle(ctx: RuleContext, ast: ASTNode): void {
  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    if (tagName(op) !== "iframe") continue;
    const attrs = attrMap(op);
    if (hasSpread(attrs)) continue;

    const title = attrs.get("title")?.value;
    if (!title?.trim()) {
      ctx.add(
        op,
        "frame-title",
        ["4.1.2"],
        "serious",
        "iframe",
        "Der iframe hat kein aussagekräftiges title-Attribut.",
        "Ergänze title=\"Beschreibung des Inhalts\".",
      );
    }
  }
}

// ── Rule: non-interactive elements with onClick but no keyboard support

function ruleClickableNonInteractive(ctx: RuleContext, ast: ASTNode): void {
  const INTERACTIVE = new Set([
    "a", "button", "input", "select", "textarea",
    "details", "summary",
  ]);
  const STATIC = new Set([
    "div", "span", "p", "li", "ul", "ol", "section",
    "article", "aside", "header", "footer", "main", "nav",
    "h1", "h2", "h3", "h4", "h5", "h6", "td", "tr",
  ]);

  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    const tag = tagName(op);
    if (!tag || !STATIC.has(tag)) continue;

    const attrs = attrMap(op);
    const hasOnClick = attrs.has("onclick") || attrs.has("onpress");
    if (!hasOnClick) continue;

    const role = attrs.get("role")?.value?.toLowerCase() ?? "";
    const tabIndex = attrs.get("tabindex")?.value;
    const hasKeyHandler =
      attrs.has("onkeydown") ||
      attrs.has("onkeyup") ||
      attrs.has("onkeypress");

    // If role is a widget role, it's intentional (but still flag missing keyboard)
    const isWidgetRole = [
      "button", "link", "menuitem", "option",
      "radio", "checkbox", "tab", "treeitem",
    ].includes(role);

    if (!isWidgetRole) {
      ctx.add(
        op,
        "no-static-element-interactions",
        ["2.1.1", "4.1.2"],
        "serious",
        tag,
        `<${tag}> mit onClick ist nicht per Tastatur bedienbar.`,
        "Verwende stattdessen <button> oder ergänze role, tabIndex={0} und onKeyDown.",
      );
    } else if (!hasKeyHandler || tabIndex === undefined) {
      ctx.add(
        op,
        "interactive-supports-focus",
        ["2.1.1", "2.4.3"],
        "moderate",
        tag,
        `<${tag} role="${role}"> könnte per Tastatur nicht erreichbar sein.`,
        "Ergänze tabIndex={0} und einen onKeyDown-Handler für Enter/Space.",
      );
    }
  }
}

// ── Rule: suspicious positive tabIndex values

function ruleTabIndex(ctx: RuleContext, ast: ASTNode): void {
  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    const attrs = attrMap(op);
    const tabIndex = attrs.get("tabindex");
    if (!tabIndex) continue;

    const val = tabIndex.value;
    if (val === null) continue; // dynamic
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) {
      ctx.add(
        op,
        "tabindex-positive",
        ["2.4.3"],
        "moderate",
        tagName(op) ?? "element",
        `tabIndex={${n}} verändert die natürliche Fokusreihenfolge.`,
        "Verwende tabIndex={0} oder tabIndex={-1}. Positive Werte vermeiden.",
      );
    }
  }
}

// ── Rule: missing or empty lang on <html> element in layouts / pages

function ruleHtmlLang(ctx: RuleContext, ast: ASTNode): void {
  const isLayout =
    ctx.filePath.includes("layout") ||
    ctx.filePath.includes("_document") ||
    ctx.filePath.includes("_app");

  if (!isLayout) return;

  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    if (tagName(op) !== "html") continue;
    const attrs = attrMap(op);
    if (hasSpread(attrs)) continue;

    const lang = attrs.get("lang");
    if (!lang || !lang.value?.trim()) {
      ctx.add(
        op,
        "html-lang",
        ["3.1.1"],
        "serious",
        "html",
        "Das <html>-Element hat kein lang-Attribut.",
        'Ergänze lang="de" (oder die passende BCP-47-Sprache).',
      );
    }
  }
}

// ── Rule: Next.js <Head> without <title> / page without metadata export

function ruleNextMetadata(ctx: RuleContext, ast: ASTNode): void {
  const isPage =
    ctx.filePath.includes("/pages/") ||
    ctx.filePath.includes("/app/") ||
    ctx.filePath.match(/page\.(tsx?|jsx?)$/) !== null;

  if (!isPage) return;

  // Check for metadata export (App Router)
  let hasMetadataExport = false;
  for (const node of walkAST(ast)) {
    if (
      node.type === "ExportNamedDeclaration" ||
      node.type === "ExportDefaultDeclaration"
    ) {
      const decl = node.declaration as ASTNode | null;
      if (!decl) continue;
      // export const metadata = { ... }
      if (
        decl.type === "VariableDeclaration"
      ) {
        const declarators = decl.declarations as ASTNode[];
        if (declarators.some(d => ((d.id as ASTNode)?.name as string) === "metadata")) {
          hasMetadataExport = true;
        }
      }
    }
  }
  if (hasMetadataExport) return;

  // Check for <Head><title> (Pages Router)
  let hasHeadTitle = false;
  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    if (tagName(op) !== "head") continue;
    for (const child of (node.children as ASTNode[]) ?? []) {
      if (child.type === "JSXElement" && tagName(opening(child)) === "title") {
        hasHeadTitle = true;
      }
    }
  }
  if (hasHeadTitle) return;

  // Neither found → warn at file level
  ctx.add(
    ast,
    "document-title",
    ["2.4.2"],
    "serious",
    "page",
    "Kein Dokumenttitel erkennbar (kein metadata-Export und kein <Head><title>).",
    "Exportiere für App Router: export const metadata = { title: '…' }; oder verwende <Head><title> im Pages Router.",
  );
}

// ── Rule: tables without headers

function ruleTableHeaders(ctx: RuleContext, ast: ASTNode): void {
  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    if (tagName(op) !== "table") continue;

    let hasTd = false;
    let hasTh = false;
    for (const child of walkAST(node)) {
      if (child.type !== "JSXElement") continue;
      const t = tagName(opening(child));
      if (t === "td") hasTd = true;
      if (t === "th") hasTh = true;
    }

    if (hasTd && !hasTh) {
      ctx.add(
        op,
        "table-headers",
        ["1.3.1"],
        "moderate",
        "table",
        "Die Tabelle enthält Datenzellen, aber keine <th>-Elemente.",
        "Markiere Spalten- oder Zeilenüberschriften mit <th scope=\"col\"> oder <th scope=\"row\">.",
      );
    }
  }
}

// ── Rule: dangerouslySetInnerHTML (security + a11y concern)

function ruleDangerousHTML(ctx: RuleContext, ast: ASTNode): void {
  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    const attrs = attrMap(op);
    if (attrs.has("dangerouslysetinnerhtml")) {
      ctx.add(
        op,
        "no-danger",
        ["4.1.1"],
        "moderate",
        tagName(op) ?? "element",
        "dangerouslySetInnerHTML kann unsicheres HTML einfügen und Accessibility-Probleme verbergen.",
        "Prüfe den Inhalt auf Accessibility-Anforderungen; erwäge DOMPurify für Sanitization.",
      );
    }
  }
}

// ── Rule: invalid ARIA roles

const VALID_ARIA_ROLES = new Set([
  "alert", "alertdialog", "application", "article", "banner",
  "button", "cell", "checkbox", "columnheader", "combobox",
  "complementary", "contentinfo", "definition", "dialog",
  "directory", "document", "feed", "figure", "form", "grid",
  "gridcell", "group", "heading", "img", "link", "list",
  "listbox", "listitem", "log", "main", "marquee", "math",
  "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio",
  "navigation", "none", "note", "option", "presentation",
  "progressbar", "radio", "radiogroup", "region", "row",
  "rowgroup", "rowheader", "scrollbar", "search", "searchbox",
  "separator", "slider", "spinbutton", "status", "switch",
  "tab", "table", "tablist", "tabpanel", "term", "textbox",
  "timer", "toolbar", "tooltip", "tree", "treegrid", "treeitem",
]);

function ruleAriaRole(ctx: RuleContext, ast: ASTNode): void {
  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    const attrs = attrMap(op);
    const roleAttr = attrs.get("role");
    if (!roleAttr || roleAttr.value === null) continue;

    const roles = roleAttr.value.trim().split(/\s+/);
    for (const role of roles) {
      if (role && !VALID_ARIA_ROLES.has(role.toLowerCase())) {
        ctx.add(
          op,
          "aria-role",
          ["4.1.2"],
          "serious",
          tagName(op) ?? "element",
          `role="${role}" ist kein gültiger ARIA-Rollenname.`,
          "Prüfe die WAI-ARIA-Spezifikation auf erlaubte Rollennamen.",
        );
      }
    }
  }
}

// ── Rule: aria-hidden on focusable elements

function ruleAriaHiddenFocusable(ctx: RuleContext, ast: ASTNode): void {
  const FOCUSABLE = new Set(["a", "button", "input", "select", "textarea"]);

  for (const node of walkAST(ast)) {
    if (node.type !== "JSXElement") continue;
    const op = opening(node);
    const tag = tagName(op);
    if (!tag || !FOCUSABLE.has(tag)) continue;
    const attrs = attrMap(op);
    const ariaHidden = attrs.get("aria-hidden");
    if (!ariaHidden) continue;

    const val = ariaHidden.value?.toLowerCase();
    if (val === "true" || val === "{true}") {
      const tabIndex = attrs.get("tabindex")?.value;
      if (tabIndex !== "-1") {
        ctx.add(
          op,
          "aria-hidden-focus",
          ["4.1.2"],
          "serious",
          tag,
          `<${tag} aria-hidden="true"> ist möglicherweise noch per Tastatur erreichbar.`,
          "Kombiniere aria-hidden mit tabIndex={-1} oder verwende inert.",
        );
      }
    }
  }
}

// ─────────────────────────────────────── File discovery

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const TSX_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const IGNORE_DIRS = new Set(["node_modules", ".next", "dist", "build", ".git", "coverage"]);

async function* discoverFiles(dir: string): AsyncGenerator<string> {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        yield* discoverFiles(path.join(dir, entry.name));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (TSX_EXTENSIONS.has(ext)) {
        yield path.join(dir, entry.name);
      }
    }
  }
}

// ─────────────────────────────────────── Audit a single file

const RULES = [
  ruleImageAlt,
  ruleFormLabels,
  ruleButtonName,
  ruleLinkName,
  ruleFrameTitle,
  ruleClickableNonInteractive,
  ruleTabIndex,
  ruleHtmlLang,
  ruleNextMetadata,
  ruleTableHeaders,
  ruleDangerousHTML,
  ruleAriaRole,
  ruleAriaHiddenFocusable,
];

async function auditFile(
  filePath: string,
  relPath: string,
): Promise<Issue[]> {
  const fileInfo = await stat(filePath);
  if (fileInfo.size > MAX_FILE_SIZE) return [];

  const source = await readFile(filePath, "utf8");

  let ast: ASTNode;
  try {
    ast = parseTSX(source, {
      jsx: true,
      range: false,
      loc: true,
      comment: false,
      tokens: false,
      errorOnUnknownASTType: false,
    }) as unknown as ASTNode;
  } catch {
    // Not valid TSX/TS (e.g. plain JS with unusual syntax) — skip
    return [];
  }

  const ctx = makeContext(relPath, source);
  for (const rule of RULES) {
    try { rule(ctx, ast); }
    catch { /* one rule failure must not abort the rest */ }
  }
  return ctx.issues;
}

// ─────────────────────────────────────── Tool export

export default tool({
  description:
    "Führt einen statischen Accessibility-Audit für TSX/TSX-React-Dateien durch. " +
    "Prüft WCAG 2.2 A/AA-Probleme anhand des Quellcodes (AST-basiert), ohne die " +
    "Anwendung auszuführen. Gibt einen maschinenlesbaren JSON-Bericht zurück. " +
    "Akzeptiert einen einzelnen Dateipfad oder ein Projektverzeichnis.",

  args: {
    target: tool.schema
      .string()
      .describe(
        "Pfad zu einer einzelnen .tsx/.ts/.jsx/.js-Datei oder zu einem Projektverzeichnis.",
      ),
  },

  async execute(args, context) {
    try {
      const root = path.resolve(context.worktree || context.directory);
      const requested = path.resolve(root, args.target);
      const relative = path.relative(root, requested);

      if (
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
      ) {
        return JSON.stringify({
          error: {
            code: "PATH_OUTSIDE_PROJECT",
            message: "Das Ziel muss innerhalb des Projektverzeichnisses liegen.",
          },
        });
      }

      // ── Single file or directory?
      const info = await stat(requested).catch(() => null);
      if (!info) {
        return JSON.stringify({
          error: { code: "NOT_FOUND", message: "Pfad nicht gefunden." },
        });
      }

      const allIssues: Issue[] = [];
      const auditedFiles: string[] = [];
      const skippedFiles: string[] = [];

      if (info.isFile()) {
        const ext = path.extname(requested).toLowerCase();
        if (!TSX_EXTENSIONS.has(ext)) {
          return JSON.stringify({
            error: {
              code: "INVALID_FILE_TYPE",
              message: `Erwartet .tsx, .ts, .jsx oder .js — erhalten: ${ext}`,
            },
          });
        }
        const relPath = path.relative(root, requested);
        const issues = await auditFile(requested, relPath);
        allIssues.push(...issues);
        auditedFiles.push(relPath);
      } else if (info.isDirectory()) {
        for await (const absPath of discoverFiles(requested)) {
          const relPath = path.relative(root, absPath);
          try {
            const issues = await auditFile(absPath, relPath);
            allIssues.push(...issues);
            auditedFiles.push(relPath);
          } catch {
            skippedFiles.push(relPath);
          }
        }
      } else {
        return JSON.stringify({
          error: { code: "INVALID_TARGET", message: "Ziel ist weder Datei noch Verzeichnis." },
        });
      }

      // ── Summary
      const bySeverity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      for (const issue of allIssues) bySeverity[issue.severity]++;

      const byRule = new Map<string, number>();
      for (const issue of allIssues) {
        byRule.set(issue.rule, (byRule.get(issue.rule) ?? 0) + 1);
      }

      return JSON.stringify(
        {
          standard: "WCAG 2.2 AA",
          mode: "static-tsx",
          status: allIssues.length === 0 ? "no-findings" : "issues-found",
          summary: {
            filesAudited: auditedFiles.length,
            filesSkipped: skippedFiles.length,
            violations: allIssues.length,
            bySeverity,
            byRule: Object.fromEntries(
              [...byRule.entries()].sort((a, b) => b[1] - a[1]),
            ),
          },
          limitations: [
            "Kein Browser-Rendering, kein JavaScript-Lauf.",
            "Dynamische Props (via Spread, Variablen, bedingtes Rendering) können nicht statisch ausgewertet werden.",
            "Farbkontrast, Fokusindikatoren und tatsächliche Tastaturbedienbarkeit erfordern Browser-Tests.",
            "htmlFor ↔ id-Verknüpfungen werden nur innerhalb einer Datei geprüft.",
            "Ein statischer Audit ersetzt kein vollständiges WCAG-Konformitätsaudit.",
          ],
          issues: allIssues,
        },
        null,
        2,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as Record<string, unknown>).code === "string"
          ? (error as Record<string, string>).code
          : "AUDIT_FAILED";

      return JSON.stringify({
        error: {
          code,
          message:
            code === "ENOENT"
              ? "Datei oder Verzeichnis nicht gefunden."
              : code === "EACCES"
                ? "Keine Leseberechtigung."
                : message,
        },
      });
    }
  },
});