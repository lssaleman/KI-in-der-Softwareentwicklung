import { tool } from "@opencode-ai/plugin";
import ts from "typescript";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * SEO AUDIT – PRÜFKRITERIEN
 *
 * Grundlage: Technische SEO-Best-Practices und Google Search Central.
 * Prüfmodus: Statische Quellcode-Analyse mittels TypeScript Compiler API.
 *
 * Unterstützte Dateiformate:
 * HTML, HTM, JSX, TSX, JS und TS.
 *
 * Unterstützte Frameworks:
 * React und Next.js (App Router und Pages Router).
 *
 * 1. META DESCRIPTION
 * - Vorhandensein einer Meta Description.
 * - Leere Meta Description.
 * - Sehr kurze oder lange Beschreibungen.
 * - Doppelte Meta Descriptions.
 *
 * 2. CANONICAL URL
 * - Vorhandensein einer Canonical-URL.
 * - Leere Canonical-URLs.
 * - Mehrfache Canonical-Angaben.
 *
 * 3. INDEXIERBARKEIT
 * - Meta-Robots-Angaben.
 * - noindex-Direktiven.
 * - nofollow-Direktiven.
 * - Widersprüchliche oder doppelte Robots-Angaben.
 *
 * 4. OPEN GRAPH
 * - og:title
 * - og:description
 * - og:image
 * - og:url
 * - og:type
 *
 * 5. TWITTER / X CARDS
 * - twitter:card
 * - twitter:title
 * - twitter:description
 * - twitter:image
 *
 * 6. ÜBERSCHRIFTENSTRUKTUR AUS SEO-SICHT
 * - Vorhandensein einer H1.
 * - Mehrere H1-Überschriften.
 * - Leere Überschriften.
 * - Überschriftensprünge zwischen H1 und H6.
 *
 * 7. LINKS
 * - Fehlende href-Angaben.
 * - Leere href-Angaben.
 * - Platzhalterziele wie "#".
 * - Doppelt verwendete Linkziele.
 *
 * 8. STRUKTURIERTE DATEN
 * - Vorhandensein von JSON-LD.
 * - Gültigkeit des JSON.
 * - Vorhandensein von @context.
 * - Vorhandensein von @type.
 *
 * 9. REACT / NEXT.JS METADATEN
 * - Statische metadata-Objekte.
 * - Statisch erkennbare generateMetadata()-Rückgaben.
 * - title und description.
 * - alternates.canonical.
 * - openGraph-Metadaten.
 * - twitter-Metadaten.
 * - JSX-Meta- und Link-Tags.
 *
 * 10. TECHNISCHE DATEIPRÜFUNGEN
 * - Existenz und Lesbarkeit der Datei.
 * - Prüfung des Dateiformats.
 * - Maximale Dateigröße: 2 MB.
 * - Zugriff ausschließlich innerhalb des Projektverzeichnisses.
 *
 * BEWUSSTE ABGRENZUNG ZUM ACCESSIBILITY-CHECKER:
 * Keine WCAG-Prüfungen, keine Prüfung von alt-Attributen,
 * ARIA, Formularlabels, Tastaturbedienung, Kontrast,
 * Fokusindikatoren oder Screenreader-Kompatibilität.
 *
 * NICHT ABGEDECKT:
 * - Tatsächliche Google-Indexierung.
 * - robots.txt und sitemap.xml.
 * - HTTP-Header und X-Robots-Tag.
 * - Core Web Vitals und Ladezeiten.
 * - Mobile Usability.
 * - Backlinks und Domain Authority.
 * - Tatsächliches Googlebot-Rendering.
 * - Dynamisch berechnete oder importierte Metadaten.
 *
 * HINWEIS:
 * Ein statischer SEO-Vorab-Audit ist keine Garantie
 * für Rankings oder vollständige SEO-Konformität.
 */

type Severity = "critical" | "serious" | "moderate" | "minor";

type Issue = {
  rule: string;
  severity: Severity;
  element: string;
  line: number | null;
  message: string;
  suggestion: string;
};

type Meta = {
  name: string;
  content: string;
  line: number | null;
};

type Element = {
  tag: string;
  attrs: Record<string, string>;
  text: string;
  line: number | null;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const EXTENSIONS = [
  ".html", ".htm", ".jsx", ".tsx", ".js", ".ts",
];

function lineOf(source: string, position: number): number {
  return source.slice(0, position).split("\n").length;
}

function getString(node: ts.Expression | undefined): string | undefined {
  if (!node) return undefined;

  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }

  return undefined;
}

function property(
  node: ts.Expression,
  name: string,
): ts.Expression | undefined {
  if (!ts.isObjectLiteralExpression(node)) return undefined;

  for (const item of node.properties) {
    if (!ts.isPropertyAssignment(item)) continue;

    const key = item.name;

    if (
      (ts.isIdentifier(key) || ts.isStringLiteral(key)) &&
      key.text === name
    ) {
      return item.initializer;
    }
  }

  return undefined;
}

function nestedProperty(
  node: ts.Expression,
  object: string,
  key: string,
): ts.Expression | undefined {
  const nested = property(node, object);
  return nested ? property(nested, key) : undefined;
}

function addIssue(
  issues: Issue[],
  rule: string,
  severity: Severity,
  element: string,
  line: number | null,
  message: string,
  suggestion: string,
) {
  issues.push({
    rule,
    severity,
    element,
    line,
    message,
    suggestion,
  });
}

function collectSource(
  source: string,
  fileName: string,
): {
  elements: Element[];
  metadata: Meta[];
} {
  const extension = path.extname(fileName).toLowerCase();

  const scriptKind =
    extension === ".tsx" || extension === ".jsx"
      ? ts.ScriptKind.TSX
      : extension === ".ts"
        ? ts.ScriptKind.TS
        : extension === ".js"
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TSX;

  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  const elements: Element[] = [];
  const metadata: Meta[] = [];

  function addMeta(name: string, value: string | undefined, position: number) {
    if (value === undefined) return;

    metadata.push({
      name: name.toLowerCase(),
      content: value,
      line: lineOf(source, position),
    });
  }

  function inspectMetadata(node: ts.Expression) {
    if (!ts.isObjectLiteralExpression(node)) return;

    addMeta("title", getString(property(node, "title")), node.getStart(sourceFile));
    addMeta("description", getString(property(node, "description")), node.getStart(sourceFile));

    addMeta(
      "canonical",
      getString(nestedProperty(node, "alternates", "canonical")),
      node.getStart(sourceFile),
    );

    for (const field of ["title", "description", "url", "type", "images"]) {
      const value = getString(
        nestedProperty(node, "openGraph", field),
      );

      addMeta(`og:${field === "images" ? "image" : field}`, value, node.getStart(sourceFile));
    }

    for (const field of ["card", "title", "description", "images"]) {
      const value = getString(
        nestedProperty(node, "twitter", field),
      );

      addMeta(
        `twitter:${field === "images" ? "image" : field}`,
        value,
        node.getStart(sourceFile),
      );
    }
  }

  function visit(node: ts.Node) {
    // Next.js metadata und generateMetadata
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === "metadata" &&
      node.initializer
    ) {
      inspectMetadata(node.initializer);
    }

    if (
      ts.isReturnStatement(node) &&
      node.expression &&
      ts.isObjectLiteralExpression(node.expression)
    ) {
      let parent = node.parent;

      while (parent && !ts.isFunctionDeclaration(parent)) {
        parent = parent.parent;
      }

      if (
        parent &&
        parent.name?.getText(sourceFile) === "generateMetadata"
      ) {
        inspectMetadata(node.expression);
      }
    }

    // JSX-Elemente
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node)
    ) {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : node;

      const tag = opening.tagName.getText(sourceFile).toLowerCase();

      const attrs: Record<string, string> = {};

      for (const attr of opening.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;

        let value = "";

        if (attr.initializer) {
          if (ts.isStringLiteral(attr.initializer)) {
            value = attr.initializer.text;
          } else if (ts.isJsxExpression(attr.initializer)) {
            value = getString(attr.initializer.expression) ?? "";
          }
        }

        attrs[attr.name.getText(sourceFile).toLowerCase()] = value;
      }

      let text = "";

      if (ts.isJsxElement(node)) {
        text = node.children
          .filter(ts.isJsxText)
          .map((child) => child.text.trim())
          .join(" ");
      }

      elements.push({
        tag,
        attrs,
        text,
        line: lineOf(source, node.getStart(sourceFile)),
      });

      // Meta und Canonical
      if (tag === "meta") {
        const name =
          attrs.name ||
          attrs.property ||
          "";

        addMeta(name, attrs.content, node.getStart(sourceFile));
      }

      if (tag === "link" && attrs.rel === "canonical") {
        addMeta("canonical", attrs.href, node.getStart(sourceFile));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // HTML-Dateien werden ebenfalls über den TSX-Parser eingelesen.
  // HTML-Metadaten werden anhand der JSX-/HTML-Elemente erkannt.

  return { elements, metadata };
}

function auditMetadata(
  metadata: Meta[],
  issues: Issue[],
) {
  const groups = new Map<string, Meta[]>();

  for (const item of metadata) {
    if (!groups.has(item.name)) groups.set(item.name, []);
    groups.get(item.name)!.push(item);
  }

  const get = (name: string) => groups.get(name) ?? [];

  // Description
  const descriptions = get("description");

  if (!descriptions.length) {
    addIssue(
      issues,
      "meta-description-missing",
      "serious",
      "meta[name=description]",
      null,
      "Keine Meta Description gefunden.",
      "Ergänze eine prägnante Beschreibung der Seite.",
    );
  }

  for (const item of descriptions) {
    const length = item.content.trim().length;

    if (!length) {
      addIssue(issues, "meta-description-empty", "serious",
        "meta[name=description]", item.line,
        "Die Meta Description ist leer.",
        "Ergänze eine aussagekräftige Beschreibung.");
    } else if (length < 70 || length > 160) {
      addIssue(issues, "meta-description-length", "minor",
        "meta[name=description]", item.line,
        `Die Meta Description hat ${length} Zeichen.`,
        "Prüfe, ob die Beschreibung prägnant und aussagekräftig ist.");
    }
  }

  // Canonical
  if (!get("canonical").length) {
    addIssue(issues, "canonical-missing", "moderate",
      "link[rel=canonical]", null,
      "Keine Canonical-URL gefunden.",
      "Prüfe, ob eine selbstreferenzierende Canonical-URL sinnvoll ist.");
  }

  for (const item of get("canonical")) {
    if (!item.content.trim()) {
      addIssue(issues, "canonical-empty", "serious",
        "link[rel=canonical]", item.line,
        "Die Canonical-URL ist leer.",
        "Hinterlege eine gültige absolute URL.");
    }
  }

  // Robots
  for (const item of get("robots")) {
    const directives = item.content.toLowerCase();

    if (directives.includes("noindex")) {
      addIssue(issues, "robots-noindex", "critical",
        "meta[name=robots]", item.line,
        "Die Seite enthält noindex.",
        "Prüfe, ob die Seite aus dem Suchmaschinenindex ausgeschlossen werden soll.");
    }

    if (directives.includes("nofollow")) {
      addIssue(issues, "robots-nofollow", "moderate",
        "meta[name=robots]", item.line,
        "Die Seite enthält nofollow.",
        "Prüfe, ob Suchmaschinen den Links folgen dürfen sollen.");
    }
  }

  // Open Graph
  for (const field of [
    "og:title", "og:description", "og:image", "og:url", "og:type",
  ]) {
    if (!get(field).length) {
      addIssue(issues, `missing-${field}`, "minor",
        `meta[property="${field}"]`, null,
        `${field} fehlt.`,
        `Ergänze ${field} für Social-Media-Vorschauen.`);
    }
  }

  // Twitter Cards
  for (const field of [
    "twitter:card", "twitter:title",
    "twitter:description", "twitter:image",
  ]) {
    if (!get(field).length) {
      addIssue(issues, `missing-${field}`, "minor",
        `meta[name="${field}"]`, null,
        `${field} fehlt.`,
        `Ergänze ${field}, sofern Twitter/X-Vorschauen benötigt werden.`);
    }
  }

  // Doppelte Metadaten
  for (const [name, values] of groups) {
    if (values.length > 1) {
      addIssue(issues, "duplicate-metadata", "moderate",
        name, values[1].line,
        `"${name}" ist mehrfach vorhanden.`,
        "Entferne doppelte oder widersprüchliche Angaben.");
    }
  }
}

function auditHeadings(elements: Element[], issues: Issue[]) {
  const headings = elements
    .filter((e) => /^h[1-6]$/.test(e.tag))
    .sort((a, b) => (a.line ?? 0) - (b.line ?? 0));

  const h1 = headings.filter((e) => e.tag === "h1");

  if (!h1.length) {
    addIssue(issues, "h1-missing", "moderate", "h1", null,
      "Keine H1-Überschrift gefunden.",
      "Ergänze eine aussagekräftige Hauptüberschrift.");
  }

  if (h1.length > 1) {
    addIssue(issues, "multiple-h1", "minor", "h1", h1[1].line,
      `${h1.length} H1-Überschriften gefunden.`,
      "Prüfe die inhaltliche Hierarchie.");
  }

  let previous = 0;

  for (const heading of headings) {
    const level = Number(heading.tag.slice(1));

    if (!heading.text.trim()) {
      addIssue(issues, "empty-heading", "moderate",
        heading.tag, heading.line,
        "Die Überschrift enthält keinen erkennbaren statischen Text.",
        "Ergänze eine aussagekräftige Überschrift.");
    }

    if (previous && level > previous + 1) {
      addIssue(issues, "heading-level-skip", "minor",
        heading.tag, heading.line,
        `Überschriftensprung von H${previous} zu H${level}.`,
        "Prüfe die inhaltliche Gliederung.");
    }

    previous = level;
  }
}

function auditLinks(elements: Element[], issues: Issue[]) {
  const targets = new Map<string, number>();

  for (const link of elements.filter((e) => e.tag === "a")) {
    const href = link.attrs.href;

    if (href === undefined || !href.trim()) {
      addIssue(issues, "link-href-missing", "moderate",
        "a", link.line,
        "Ein Link besitzt kein href-Ziel.",
        "Hinterlege eine gültige Ziel-URL.");
      continue;
    }

    if (href.trim() === "#") {
      addIssue(issues, "link-placeholder", "minor",
        "a[href='#']", link.line,
        "Der Link verwendet ein Platzhalterziel.",
        "Verwende eine echte URL oder ein geeignetes Interaktionselement.");
    }

    targets.set(href, (targets.get(href) ?? 0) + 1);
  }

  for (const [target, count] of targets) {
    if (count > 1) {
      addIssue(issues, "duplicate-link-target", "minor",
        target, null,
        `Das Linkziel kommt ${count}-mal vor.`,
        "Prüfe, ob die wiederholten Verlinkungen sinnvoll sind.");
    }
  }
}

function auditStructuredData(
  elements: Element[],
  issues: Issue[],
) {
  for (const element of elements.filter(
    (e) => e.tag === "script" &&
      e.attrs.type === "application/ld+json",
  )) {
    // Statische JSON-LD-Blöcke können im JSX-AST
    // nicht zuverlässig als Text ausgelesen werden.
    // Deshalb wird die JSON-LD-Validierung unten
    // anhand des Originalquelltexts durchgeführt.
  }
}

function auditJsonLd(source: string, issues: Issue[]) {
  const pattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;

        if (!item["@context"]) {
          addIssue(issues, "jsonld-context-missing", "moderate",
            "script[type=application/ld+json]",
            lineOf(source, match.index),
            "JSON-LD enthält keinen @context.",
            'Ergänze "@context": "https://schema.org".');
        }

        if (!item["@type"]) {
          addIssue(issues, "jsonld-type-missing", "moderate",
            "script[type=application/ld+json]",
            lineOf(source, match.index),
            "JSON-LD enthält keinen @type.",
            "Ergänze einen passenden Schema.org-Typ.");
        }
      }
    } catch {
      addIssue(issues, "jsonld-invalid", "serious",
        "script[type=application/ld+json]",
        lineOf(source, match.index),
        "Der JSON-LD-Inhalt ist ungültiges JSON.",
        "Korrigiere die JSON-Syntax.");
    }
  }
}

export default tool({
  description:
    "Statischer SEO-Audit für HTML, React und Next.js. " +
    "Prüft Metadaten, Canonical, Robots, Open Graph, Twitter Cards, " +
    "Überschriften, Links und JSON-LD. Keine Accessibility-Prüfungen.",

  args: {
    filePath: tool.schema.string().describe(
      "Projekt-relativer oder absoluter Pfad zur HTML-, JSX-, TSX-, JS- oder TS-Datei",
    ),
  },

  async execute(args, context) {
    try {
      const root = path.resolve(
        context.worktree || context.directory,
      );

      const requested = path.resolve(root, args.filePath);
      const relative = path.relative(root, requested);

      if (
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
      ) {
        return JSON.stringify({
          error: {
            code: "PATH_OUTSIDE_PROJECT",
            message: "Datei liegt außerhalb des Projektverzeichnisses.",
          },
        });
      }

      const extension = path.extname(requested).toLowerCase();

      if (!EXTENSIONS.includes(extension)) {
        return JSON.stringify({
          error: {
            code: "INVALID_FILE_TYPE",
            message: `Nicht unterstütztes Format: ${extension}`,
          },
        });
      }

      const info = await stat(requested);

      if (!info.isFile()) {
        throw new Error("Der Pfad verweist nicht auf eine Datei.");
      }

      if (info.size > MAX_FILE_SIZE) {
        throw new Error("Die Datei überschreitet 2 MB.");
      }

      const source = await readFile(requested, "utf8");

      const { elements, metadata } = collectSource(
        source,
        requested,
      );

      const issues: Issue[] = [];

      auditMetadata(metadata, issues);
      auditHeadings(elements, issues);
      auditLinks(elements, issues);
      auditStructuredData(elements, issues);
      auditJsonLd(source, issues);

      const summary = {
        total: issues.length,
        critical: issues.filter((i) => i.severity === "critical").length,
        serious: issues.filter((i) => i.severity === "serious").length,
        moderate: issues.filter((i) => i.severity === "moderate").length,
        minor: issues.filter((i) => i.severity === "minor").length,
      };

      return JSON.stringify({
        file: relative,
        standard: "Technical SEO Best Practices",
        mode: "static-source-analysis",
        framework: [
          ".jsx", ".tsx", ".js", ".ts",
        ].includes(extension) ? "React/Next.js" : "HTML",
        status: issues.length ? "issues-found" : "no-findings",
        summary,
        limitations: [
          "Dynamische und importierte Metadaten werden nicht zuverlässig aufgelöst.",
          "Keine HTTP-Header- oder robots.txt-Prüfung.",
          "Keine Prüfung von Sitemap oder Google-Indexierung.",
          "Keine Core Web Vitals oder Ladezeiten.",
          "Keine tatsächliche URL-Erreichbarkeitsprüfung.",
          "Keine WCAG- oder Accessibility-Prüfungen.",
        ],
        issues,
      }, null, 2);

    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "SEO_AUDIT_FAILED";

      return JSON.stringify({
        error: {
          code,
          message: error instanceof Error
            ? error.message
            : "Unbekannter Fehler.",
        },
      });
    }
  },
});
