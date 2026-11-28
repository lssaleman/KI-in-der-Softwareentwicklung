# KI-in-der-Softwareentwicklung
Ein Harness zum Entwickeln von Webseiten für Sportvereine

## Installation

Harness und Zielprojekt liegen in diesem Repository zusammen. Es gibt kein
separates Installationsskript.

### Voraussetzungen

- Git
- Node.js 24 (mindestens 24.22.1, siehe `engines` in `package.json`) und npm
- OpenCode (Version: <Ausgabe von `opencode --version` eintragen>)
- Ein Abonnement für OpenCode Go mit API-Key

### Schritte

1. **Repository klonen**

   ```bash
   git clone https://github.com/lssaleman/KI-in-der-Softwareentwicklung.git
   cd KI-in-der-Softwareentwicklung
   ```

2. **Abhängigkeiten installieren**

   ```bash
   npm install
   ```

3. **OpenCode starten** (im Projektstamm, damit `AGENTS.md`, `opencode.json`
   und `.opencode/` gefunden werden)

   ```bash
   opencode
   ```

4. **Beim ersten Start mit OpenCode Go verbinden:** `/connect` eingeben,
   "OpenCode Go" wählen und den API-Key einfügen. Das Modell
   (`opencode-go/qwen3.7-plus`) ist in `opencode.json` voreingestellt.

Danach kann direkt ein Auftrag als Prompt eingegeben werden.

### Was zum Harness gehört

| Datei / Ordner | Zweck |
|---|---|
| `AGENTS.md` | Regeln und Arbeitsweise des Agenten |
| `SPEC.md` | Spezifikation der Vereinswebseite |
| `opencode.json` | Modell und Berechtigungen (harte Restriktionen) |
| `.opencode/tools/` | Eigene Tools `accessibility_audit` und `seo_audit`. Der Agent ruft sie beim Implementieren auf; `verify` ruft dieselben Tools bei jedem vollständigen Versuch auf |
| `.opencode/scripts/audit-fixtures/` | Beispielprojekte (korrekt und fehlerhaft) für den Selbsttest der Tools |
| `.opencode/agents/` | Subagent `test-writer`, schreibt die Tests |
| `.opencode/scripts/verify.mjs` | Prüfskript (`npm run verify`): Typprüfung, ESLint, Tests, beide Tools, Build, Logging, Nummerierung der Versuche, Abbruch bei Endlosschleifen; `--quick` nur Typprüfung, ESLint und Tests |
| `.opencode/scripts/load-tool.mjs` | Lädt die beiden Tools für `verify.mjs`, damit `verify` dieselbe Implementierung nutzt wie der Agent |
| `.opencode/scripts/audit-selftest.mjs` | Selbsttest der beiden Tools (`npm run audit:selftest`): kein Fehlalarm auf korrektem Code, jede Regel findet ihren Fehler |
| `.opencode/scripts/perf.mjs` | Performance-Messung (`npm run perf`): Lighthouse mobil für jede Seite, Logging |
| `package.json` | Skripte `test`, `lint`, `format`, `verify`, `perf`, `audit:selftest` und die Pakete für die Tools |
| `tsconfig.json` | TypeScript-Einstellungen (Strict Mode), schreibgeschützt |
| `vitest.config.ts`, `vitest.setup.ts` | Test-Setup für den Subagenten `test-writer`, schreibgeschützt |

### Harness in ein anderes Projekt übernehmen

Für ein bestehendes Next.js-Projekt die Dateien aus der Tabelle oben in den
Projektstamm kopieren und dort `opencode` starten. `package.json` dabei nicht
ersetzen, sondern zusammenführen: die Skripte des Harness sowie die
`dependencies` und `devDependencies` übernehmen und danach `npm install`
ausführen. Ohne ESLint meldet `verify` `lint: SKIPPED`, und der Agent folgt den
Fallback-Regeln in `AGENTS.md`. Einfacher geht es mit `setup_durchlauf.sh`, das
Next.js, Supabase, ESLint, Prettier, Vitest und Lighthouse gleich mit einrichtet.

### Use of AI tools
- Accessibility tool wurde mit KI geschrieben
- Accessibility- und SEO-Tool, `verify.mjs`, Selbsttest und Setup-Skript wurden mit KI überarbeitet: Fehlalarme bei dynamischen Werten beseitigt, Tools zusätzlich in `verify` eingebunden, Schnellprüfung und Abbruchregel ergänzt
- SEO tool wurde mit KI geschrieben
- Formulierungen wurden mit KI überarbeitet
- Strukturierung in Markdown mit KI Unterstützung geschrieben
- Das Config-tool für die Tests wurde mit KI geschrieben
- Lizenzinformationen zu openweight und opensource und Datenschutzinformationen mit KI recherchiert
- Unbekannte Begriffe von KI erklären lassen
- Dokumentation des Sandbox und Permission Konzepts von KI vorformulieren lassen und an unsere Entscheidungsgründe angepasst