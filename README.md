# KI-in-der-Softwareentwicklung
Ein Harness zum Entwickeln von Webseiten für Sportvereine

## Installation in ein Projekt

Der Harness wird nicht direkt im Harness-Repo benutzt. `install.sh` kopiert
Konfiguration und Tool in ein **Zielprojekt**, und der Agent arbeitet dort.

### Voraussetzungen

- Node.js (Version: <eintragen>) und npm
- OpenCode (Version: <Ausgabe von `opencode --version` eintragen>)
- Zugriff auf das Modell Big Pickle über OpenCode
- Internetzugang (für `npm install`)

### Schritte

1. **Zielprojekt anlegen.** `setup_durchlauf.sh` erzeugt ein frisches
   Next.js-Projekt (React, Tailwind, Supabase-Client) unter
   `sportwebseiten/durchlauf_XX`:

```bash
   ./setup_durchlauf.sh
```

2. **Harness installieren.** Das Skript kopiert `AGENTS.md`, `opencode.json`
   und `.opencode/` (inklusive `run_tests`) ins Zielprojekt und richtet die
   Testumgebung ein:

```bash
   ./vereins-harness/install.sh sportwebseiten/durchlauf_XX
```

3. **Agent starten.** OpenCode muss im Zielprojekt gestartet werden, weil
   es `AGENTS.md`, `opencode.json` und `.opencode/` aus dem aktuellen
   Verzeichnis liest:

```bash
   cd sportwebseiten/durchlauf_XX
   opencode
```

   Danach das Modell wählen (`/models`) und den Auftrag als Prompt eingeben.

### Hinweise

- Die Reihenfolge ist wichtig: Erst das Zielprojekt anlegen, dann `install.sh`
  ausführen. `setup_durchlauf.sh` löscht vorhandene `AGENTS.md`-Dateien, die
  `install.sh` mitgebracht hätte.
- Wird `opencode` im Harness-Repo statt im Zielprojekt gestartet, findet der
  Agent weder Regeln noch Tool.
- Jeder Durchlauf bekommt ein eigenes Verzeichnis. So bleiben Läufe mit
  verschiedenen Modellen oder Prompts vergleichbar.