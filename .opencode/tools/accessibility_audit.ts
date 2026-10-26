/// <reference types="node" />

import { tool } from "@opencode-ai/plugin";
import { parse } from "parse5";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

type HtmlAttribute = {
  name: string;
  value: string;
};

type HtmlNode = {
  nodeName?: string;
  tagName?: string;
  value?: string;
  attrs?: HtmlAttribute[];
  childNodes?: HtmlNode[];
  content?: HtmlNode;
  parentNode?: HtmlNode;
  sourceCodeLocation?: {
    startLine?: number;
    startCol?: number;
  } | null;
};

type Issue = {
  rule: string;
  wcag: string[];
  severity: "critical" | "serious" | "moderate" | "minor";
  element: string;
  line: number | null;
  message: string;
  suggestion: string;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

function attr(node: HtmlNode, name: string): string | undefined {
  return node.attrs?.find(
    (attribute) => attribute.name.toLowerCase() === name.toLowerCase(),
  )?.value;
}

function hasAttr(node: HtmlNode, name: string): boolean {
  return node.attrs?.some(
    (attribute) => attribute.name.toLowerCase() === name.toLowerCase(),
  ) ?? false;
}

function textContent(node: HtmlNode): string {
  let result = node.value ?? "";

  for (const child of node.childNodes ?? []) {
    result += ` ${textContent(child)}`;
  }

  if (node.content) {
    result += ` ${textContent(node.content)}`;
  }

  return result.replace(/\s+/g, " ").trim();
}

function walk(node: HtmlNode, callback: (node: HtmlNode) => void): void {
  callback(node);

  for (const child of node.childNodes ?? []) {
    walk(child, callback);
  }

  if (node.content) {
    walk(node.content, callback);
  }
}

function isElement(node: HtmlNode, tag: string): boolean {
  return node.tagName?.toLowerCase() === tag;
}

function getAttr(node: HtmlNode, name: string): string {
  return attr(node, name) ?? "";
}

function selector(node: HtmlNode): string {
  const tag = node.tagName ?? node.nodeName ?? "unknown";
  const id = attr(node, "id");

  if (id) {
    return `${tag}#${id}`;
  }

  const className = attr(node, "class")
    ?.trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join("");

  return `${tag}${className ?? ""}`;
}

function hasAccessibleName(
  node: HtmlNode,
  ids: Map<string, HtmlNode>,
): boolean {
  if (getAttr(node, "aria-label").trim()) {
    return true;
  }

  const labelledBy = getAttr(node, "aria-labelledby")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (
    labelledBy.some((id) => {
      const referenced = ids.get(id);
      return referenced !== undefined && textContent(referenced).length > 0;
    })
  ) {
    return true;
  }

  if (getAttr(node, "title").trim()) {
    return true;
  }

  if (isElement(node, "img") && hasAttr(node, "alt")) {
    return getAttr(node, "alt").trim().length > 0;
  }

  return textContent(node).length > 0;
}

function isInsideLabel(node: HtmlNode): boolean {
  let parent = node.parentNode;

  while (parent) {
    if (isElement(parent, "label")) {
      return true;
    }

    parent = parent.parentNode;
  }

  return false;
}

export default tool({
  description:
    "Führt einen statischen Accessibility-Audit einer lokalen HTML-Datei durch. " +
    "Prüft grundlegende WCAG 2.2 A/AA-Probleme und gibt einen JSON-Bericht zurück. " +
    "Die Datei wird nicht verändert. CSS-Kontrast und dynamische Interaktionen " +
    "werden nicht als geprüft ausgegeben.",

  args: {
    filePath: tool.schema.string()
      .describe("Absoluter oder projekt-relativer Pfad zur HTML-Datei"),
  },

  async execute(args, context) {
    try {
      const root = path.resolve(context.worktree || context.directory);
      const requested = path.resolve(root, args.filePath);
      const relative = path.relative(root, requested);

      // Nur Dateien innerhalb des Projekt-Roots erlauben.
      if (
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
      ) {
        return JSON.stringify({
          error: {
            code: "PATH_OUTSIDE_PROJECT",
            message: "Die Datei muss innerhalb des Projektverzeichnisses liegen.",
          },
        });
      }

      if (![".html", ".htm"].includes(path.extname(requested).toLowerCase())) {
        return JSON.stringify({
          error: {
            code: "INVALID_FILE_TYPE",
            message: "Erwartet wird eine Datei mit der Endung .html oder .htm.",
          },
        });
      }

      const fileInfo = await stat(requested);

      if (!fileInfo.isFile()) {
        return JSON.stringify({
          error: {
            code: "NOT_A_FILE",
            message: "Der angegebene Pfad ist keine reguläre Datei.",
          },
        });
      }

      if (fileInfo.size > MAX_FILE_SIZE) {
        return JSON.stringify({
          error: {
            code: "FILE_TOO_LARGE",
            message: `Die HTML-Datei darf höchstens ${MAX_FILE_SIZE} Bytes groß sein.`,
          },
        });
      }

      const source = await readFile(requested, "utf8");
      const document = parse(source, {
        sourceCodeLocationInfo: true,
      }) as unknown as HtmlNode;

      const nodes: HtmlNode[] = [];
      walk(document, (node) => nodes.push(node));

      const issues: Issue[] = [];

      const addIssue = (
        node: HtmlNode,
        rule: string,
        wcag: string[],
        severity: Issue["severity"],
        message: string,
        suggestion: string,
      ) => {
        issues.push({
          rule,
          wcag,
          severity,
          element: selector(node),
          line: node.sourceCodeLocation?.startLine ?? null,
          message,
          suggestion,
        });
      };

      const html = nodes.find((node) => isElement(node, "html"));
      const title = nodes.find((node) => isElement(node, "title"));

      // WCAG 3.1.1: Sprache der Seite
      if (!html || !getAttr(html, "lang").trim()) {
        addIssue(
          html ?? document,
          "html-lang",
          ["3.1.1"],
          "serious",
          "Die Standardsprache des Dokuments ist nicht angegeben.",
          'Setze am HTML-Element ein gültiges Sprachattribut, z. B. lang="de".',
        );
      }

      // WCAG 2.4.2: Dokumenttitel
      if (!title || !textContent(title)) {
        addIssue(
          html ?? document,
          "document-title",
          ["2.4.2"],
          "serious",
          "Der Dokumenttitel fehlt oder ist leer.",
          "Ergänze im head-Element einen aussagekräftigen title.",
        );
      }

      const ids = new Map<string, HtmlNode>();
      const duplicateIds = new Set<string>();

      for (const node of nodes) {
        const id = getAttr(node, "id");

        if (!id) continue;

        if (ids.has(id)) {
          duplicateIds.add(id);
          addIssue(
            node,
            "duplicate-id",
            ["4.1.2"],
            "serious",
            `Die ID "${id}" ist mehrfach vergeben.`,
            "Vergib für jedes Element eine eindeutige ID und aktualisiere Referenzen.",
          );
        } else {
          ids.set(id, node);
        }
      }

      // WCAG 1.1.1: Textalternativen für Bilder
      for (const node of nodes.filter((n) => isElement(n, "img"))) {
        if (!hasAttr(node, "alt")) {
          addIssue(
            node,
            "image-alt",
            ["1.1.1"],
            "critical",
            "Das Bild hat kein alt-Attribut.",
            "Ergänze einen passenden Alternativtext. Für rein dekorative Bilder verwende alt=\"\".",
          );
        }
      }

      // WCAG 1.3.1 und 4.1.2: Formularbeschriftungen
      for (const node of nodes.filter((n) =>
        ["input", "select", "textarea"].some((tag) => isElement(n, tag)),
      )) {
        const type = getAttr(node, "type").toLowerCase();

        if (isElement(node, "input") && ["hidden", "submit", "button", "reset", "image"].includes(type)) {
          if (type === "image" && !hasAccessibleName(node, ids)) {
            addIssue(
              node,
              "input-image-name",
              ["4.1.2"],
              "serious",
              "Das Bild-Input hat keinen erkennbaren zugänglichen Namen.",
              "Ergänze einen passenden alt-Text oder aria-label.",
            );
          }
          continue;
        }

        const id = getAttr(node, "id");
        const hasLabelFor = id
          ? nodes.some(
              (candidate) =>
                isElement(candidate, "label") &&
                getAttr(candidate, "for") === id &&
                textContent(candidate).length > 0,
            )
          : false;

        const hasLabel =
          hasLabelFor ||
          isInsideLabel(node) ||
          getAttr(node, "aria-label").trim().length > 0 ||
          getAttr(node, "aria-labelledby").trim().length > 0;

        if (!hasLabel) {
          addIssue(
            node,
            "form-field-label",
            ["1.3.1", "3.3.2", "4.1.2"],
            "critical",
            "Das Formularfeld besitzt keine erkennbare Beschriftung.",
            "Verknüpfe ein label-Element mit dem Feld oder ergänze einen geeigneten zugänglichen Namen.",
          );
        }
      }

      // WCAG 2.4.4: Linkzweck
      for (const node of nodes.filter((n) => isElement(n, "a"))) {
        if (!hasAccessibleName(node, ids)) {
          addIssue(
            node,
            "link-name",
            ["2.4.4", "4.1.2"],
            "serious",
            "Der Link hat keinen erkennbaren zugänglichen Namen.",
            "Füge beschreibenden Linktext oder einen geeigneten zugänglichen Namen hinzu.",
          );
        }
      }

      // WCAG 4.1.2: Name von Buttons
      for (const node of nodes.filter((n) => isElement(n, "button"))) {
        if (!hasAccessibleName(node, ids)) {
          addIssue(
            node,
            "button-name",
            ["4.1.2"],
            "critical",
            "Der Button hat keinen erkennbaren zugänglichen Namen.",
            "Füge sichtbaren Text, aria-label oder aria-labelledby hinzu.",
          );
        }
      }

      // WCAG 2.4.2 / 4.1.2: Titel für eingebettete Frames
      for (const node of nodes.filter((n) =>
        ["iframe", "frame"].some((tag) => isElement(n, tag)),
      )) {
        if (!getAttr(node, "title").trim()) {
          addIssue(
            node,
            "frame-title",
            ["4.1.2"],
            "serious",
            "Der Frame besitzt keinen aussagekräftigen Titel.",
            "Ergänze ein beschreibendes title-Attribut.",
          );
        }
      }

      // WCAG 1.3.1: Tabellenüberschriften
      for (const node of nodes.filter((n) => isElement(n, "table"))) {
        const descendants: HtmlNode[] = [];
        walk(node, (child) => descendants.push(child));

        const hasCells = descendants.some((n) => isElement(n, "td"));
        const hasHeaders = descendants.some((n) => isElement(n, "th"));

        if (hasCells && !hasHeaders) {
          addIssue(
            node,
            "table-headers",
            ["1.3.1"],
            "moderate",
            "Die Tabelle enthält Datenzellen, aber keine th-Elemente.",
            "Prüfe, ob Spalten- oder Zeilenüberschriften erforderlich sind, und markiere diese mit th.",
          );
        }
      }

      const countBySeverity = {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
      };

      for (const issue of issues) {
        countBySeverity[issue.severity]++;
      }

      return JSON.stringify({
        file: path.relative(root, requested),
        standard: "WCAG 2.2 AA",
        mode: "static-html",
        status: issues.length === 0 ? "no-findings" : "issues-found",
        summary: {
          violations: issues.length,
          bySeverity: countBySeverity,
          duplicateIds: duplicateIds.size,
        },
        limitations: [
          "Kein Browser-Rendering und keine Ausführung von JavaScript.",
          "CSS-Kontrast, sichtbare Fokusindikatoren und Reflow werden nicht geprüft.",
          "Dynamische Zustände, tatsächliche Tastaturbedienbarkeit und Screenreader-Ausgabe erfordern zusätzliche Tests.",
          "Ein statischer Audit kann weder WCAG-Konformität noch Barrierefreiheit garantieren.",
          "Die Regelprüfungen sind Heuristiken und ersetzen kein vollständiges WCAG-Audit.",
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
          : undefined;

      const message =
        error instanceof Error ? error.message : "Unbekannter Fehler";

      return JSON.stringify({
        error: {
          code: code ?? "AUDIT_FAILED",
          message:
            code === "ENOENT"
              ? "Die HTML-Datei wurde nicht gefunden."
              : code === "EACCES"
                ? "Keine Berechtigung zum Lesen der Datei."
                : message,
        },
      });
    }
  },
});