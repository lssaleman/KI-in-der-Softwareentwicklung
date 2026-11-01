# KI-in-der-Softwareentwicklung
Ein Harness zum Entwickeln von Webseiten für Sportvereine

## Installation

Harness und Zielprojekt liegen in diesem Repository zusammen. Es gibt kein
separates Installationsskript.

### Voraussetzungen

- Git
- Node.js (getestet mit Version 20.20.2) und npm
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
| `.opencode/tools/` | Eigene Tools, z. B. `accessibility_audit` |

### Harness in ein anderes Projekt übernehmen

Für ein bestehendes Next.js-Projekt die Dateien aus der Tabelle oben in den
Projektstamm kopieren und dort `opencode` starten.
