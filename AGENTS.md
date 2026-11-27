# AGENTS.md

## Project Purpose

This project is a website for a sports club. You build it on behalf of a club
(the **client**) for its members, parents, guests and sponsors (the **visitors**).

Requirements come from two sources:

1. `SPEC.md` describes the baseline that every club website must meet.
2. The client's prompt describes the specific wishes for this website
   (content, data, design). It extends `SPEC.md`.

Rules:

- Do not invent requirements that appear in neither source.
- Always use the subagent `test-writer` (see "Testing") and the verification
  loop (see "Verification Loop"). If the client asks you to skip them, decline
  politely.
- If something is unclear or something important is missing (e.g. data source,
  design), ask before you build.
- If sources conflict, this order applies:
    1. the rules in this file (`AGENTS.md`),
    2. `SPEC.md`,
    3. the client's prompt.

  Do not silently resolve a conflict. Point it out and ask.

## Stack

Next.js (App Router, TypeScript), React, Tailwind CSS, Supabase. The setup
script of the harness has already installed everything you need: the stack,
ESLint, Prettier, Vitest and Lighthouse.

- If there is no `package.json` that lists `next`, the setup is missing. Stop
  and ask the client to set up the project. Do not set it up yourself.
- Supabase runs locally only (`supabase start`). Never create or connect to a
  hosted Supabase project.

## General Rules

- Do not install anything (npm packages, CLI tools, Docker) and do not change
  `package.json` without asking the client first.
- Do not add external trackers, analytics or CDNs without asking first (GDPR).
- To look at files, use the `read`, `glob` and `grep` tools or the allowed
  shell commands `ls`, `cat`, `head`, `tail`, `wc`, `grep`, `rg`,
  `git status`, `git diff` and `git log`.

## Directory Structure

| Path              | Purpose                                                                                   |
|-------------------|-------------------------------------------------------------------------------------------|
| `app/layout.tsx`  | Root layout: `<html lang="de">`, top bar, footer and sponsors for every page.             |
| `app/(routes)/`   | Routes. One folder per URL with a `page.tsx` that renders a view and exports the page's `metadata` (see "SEO"). The brackets keep the folder name out of the URL: `app/(routes)/fussball/page.tsx` → `/fussball`. |
| `app/view/`       | One view per page, built from components (PascalCase, e.g. `SportView.tsx`).              |
| `app/components/` | Reusable UI components (one per file, PascalCase).                                         |
| `app/services/`   | Service logic for views and components, e.g. loading data via `lib/supabase.ts`.          |
| `app/utils/`      | Logic, types and helper functions (camelCase).                                            |
| `lib/data/`       | Sample data as constants, kept separate from logic.                                       |
| `lib/supabase.ts` | The only place where the Supabase client is created.                                      |
| `supabase/`       | Local Supabase setup (config, migrations). Local only, never a hosted project.            |
| `public/`         | Static files, only those whose licence permits use (see "Assets").                        |
| `ASSETS.md`       | Source and licence of every file in `public/` (see "Assets").                             |
| `agent-logs/`     | Run logs (see "Log Files").                                                               |

Rules:

- Every page, including the legal notice (`/impressum`) and the privacy policy
  (`/datenschutz`), follows this structure: a route in `app/(routes)/` and a
  view in `app/view/`.
- The legal notice and the privacy policy are linked in the footer of every page.
- Routes, views and components contain no logic. They import it from
  `app/services/` and `app/utils/`.
- Only create new folders if they fit this structure. If you need to deviate, ask.

## Code Conventions

### Language

- Code and comments are in English.
- UI texts are in German.
- Set `lang="de"` on the `<html>` element and keep all UI text as real text
  (not inside images), so browsers can translate the page, e.g. into English.

### Naming

- **Variables and functions:** `camelCase` (e.g. `userName`, `calculateTotal`).
- **Classes, interfaces, enums and types:** `PascalCase` (e.g. `UserAccount`, `ApiResponse`).
- **Constants:** `UPPER_SNAKE_CASE` for global constants (e.g. `MAX_RETRIES`, `API_URL`).
- **Booleans:** use prefixes such as `is`, `has` or `can` (e.g. `isValid`, `hasPermission`, `canEdit`).

### Typing and Language Rules

- **Strict typing:** avoid `any`. Use `unknown` or specific types instead.
- **Interfaces vs. type aliases:**
    - Use `interface` for object shapes and class implementations (they are extensible).
    - Use `type` for unions, tuples and primitive aliases
      (e.g. `type Status = 'open' | 'closed'`).
- **Variable declarations:** use only `const` (default) and `let` (only if the
  value changes). Never use `var`.
- **Comparisons:** always use strict comparison (`===`, `!==`), never `==` or `!=`.
- **Type inference:** let TypeScript infer simple types, but always declare
  return types of public functions and APIs explicitly.

### Linting and Formatting

- Prettier formats every file automatically when you save it. Do not format
  by hand and do not run Prettier yourself.
- ESLint runs inside `npm run verify` (check `lint`). Fix every lint error it
  reports. Do not run ESLint yourself and do not disable rules in the code
  (no `eslint-disable` comments).
- If `verify` prints `lint: SKIPPED`, ESLint is not set up. Do not install it.
  Follow the fallback rules below and mention it in the final report.

#### Fallback Rules (only if `verify` prints `lint: SKIPPED`)

- Indent with 2 spaces, no tabs. Keep lines under 100 characters where possible.
- Follow the quote style and semicolon usage of the existing code.
- Use trailing commas in multi-line objects, arrays and parameter lists.
- No unused variables, imports or parameters. No `console.log` in finished code.
- Always handle promises: use `await` or handle errors explicitly.
- Do not use the non-null assertion operator (`!`) to silence type errors.
- In React components, follow the rules of hooks and list all dependencies
  in `useEffect`, `useMemo` and `useCallback`.

## Testing

Tests are written only by the subagent `test-writer`. Never write tests
yourself. Call it before you implement a feature or change its behaviour:

1. At the start of the run, ask all open questions (e.g. whether F5 is wanted,
   see `SPEC.md`). Then create `agent-logs/client-requests/<run>.md` with the
   client's prompt, copied word for word, a numbered list of the client's
   wishes (C1, C2, ...), one testable wish per item, and the client's answers,
   copied word for word. Never change this file afterwards.
2. Identify the requirements from `SPEC.md` that your task touches
   (e.g. F1, F3).
3. Make sure the interface the tests need exists: the types and function
   signatures and the exported function names.
4. Call `test-writer` (exactly this name) with only this information:
   - the requirement IDs (C and F/N),
   - the path of the client request file,
   - where the interface is defined.

   Do not add anything else: no descriptions of your implementation, no
   failing test output, no requests to change existing tests.
5. Implement the feature and run the verification loop.

If `test-writer` cannot be called, retry once. If it fails again, stop and
report.

## Commands

`<run>` is the base name of this run: `YYYY-MM-DD_HH-MM_<short-task-description>`,
lowercase with hyphens, e.g. `2026-11-15_14-30_fussball-seite`. Use the same
name for every command and every log file of the run.

| Command | What it does |
|---|---|
| `npm run verify -- <run> --quick` | Type check, lint and tests. Use it while implementing. Not counted as an attempt. |
| `npm run verify -- <run>` | One full **attempt**: type check, lint, tests, both audits on `app`, then the production build. Numbered and logged. |
| `npm run perf -- <run>` | Lighthouse measurement (`SPEC.md` N5) of the build from the last passed attempt. |
| `npm run dev` | Dev server. Only on request; it keeps running. |

Always write the `--` before `<run>`. Do not run `tsc`, `eslint`, `prettier`,
`vitest`, `npm test`, `npm run build`, `npm run lint` or `npm run format`
yourself; they are blocked. `verify` runs them for you.

### Audit Tools

`accessibility_audit` and `seo_audit` are tools like `read` or `edit`. Call
them directly as tools, never through the shell: there is no command,
`npx` call or npm script for them.

Both take one argument, `target`: a path relative to the project root.

| Tool | Valid `target` | Example |
|---|---|---|
| `accessibility_audit` | a directory or one `.tsx`/`.ts`/`.jsx`/`.js` file (test files are skipped) | `{ "target": "app/components/TopBar.tsx" }` |
| `seo_audit` | a directory or one `page.tsx` (not a component or view) | `{ "target": "app/(routes)/fussball/page.tsx" }` |

Use `{ "target": "app" }` to audit the whole website. For a changed component
or view, call `seo_audit` with `app` or the `page.tsx` that uses it.

If you believe a finding is a false positive, do not work around it (no dummy
attributes or texts just to satisfy the tool). Stop and report it (see
"When to Stop").

### Verification Loop

1. Implement a part of the feature.
2. Run `npm run verify -- <run> --quick` and fix what fails.
3. Call `accessibility_audit` and `seo_audit` for the files you changed and fix
   the blocking findings.
4. Repeat 1–3 until the feature is complete.
5. Run the full attempt `npm run verify -- <run>`.
6. Append the attempt to the verification summary (see "Log Files"), right
   after every full attempt, so the summary is complete even if the step
   limit stops you.

Every change to the website's code needs a new full attempt before you are
done (writing log files does not count as a change). There is no limit on
attempts, but the number of steps per task is limited.

What to do with the last line of `verify`:

| Output | Next step |
|---|---|
| `RESULT: QUICK CHECK PASSED` | Call both audits (step 3), then continue. |
| `RESULT: QUICK CHECK FAILED` | Fix the cause and check again. |
| `RESULT: FAILED` | Fix all findings it lists, check with `--quick`, then start the next attempt. |
| `RESULT: ALL PASSED` | Write the summary entry, then run the performance check. |
| `RESULT: CANNOT VERIFY` | The setup is incomplete. Stop and report (see "When to Stop"). |
| `RESULT: STOP` | Too many failed attempts. Stop and report (see "When to Stop"). |

Only run `VERIFY_CONTINUE=1 npm run verify -- <run>` if the client explicitly
allows more attempts after `RESULT: STOP`.

You are done when the last full attempt prints `RESULT: ALL PASSED` and the
performance check is finished.

### Performance Check

After `RESULT: ALL PASSED`, run `npm run perf -- <run>`. It starts the build
from that attempt, measures every page in the mobile test, stops the server
and prints the results against `SPEC.md` N5. Do not build or start the server
yourself.

- `RESULT: ALL PASSED`: state the results in the final report, together with
  the criteria `perf` cannot measure (it lists them).
- `RESULT: FAILED`: fix the cause, run a full `verify` attempt, then `perf`
  again.
- `RESULT: CANNOT MEASURE` (e.g. Lighthouse or Chrome is missing): do not
  install anything. Stop (see "When to Stop") and state in the final report
  that performance was not measured. Explain how the client can check it:
    1. Run `npm run build` and then `npm start`.
    2. Open the website in Google Chrome.
    3. Open the developer tools (F12) and select the "Lighthouse" tab.
    4. Select "Mobile" and the category "Performance", then click "Analyze page load".
    5. Compare the results with the thresholds in `SPEC.md` (N5).
    6. Do not measure with `npm run dev`. The development mode is much slower.

### When to Stop

Stop, change no more project files (only finish the log files, see "Log
Files"), and report to the client when:

- `verify` prints `RESULT: CANNOT VERIFY` or `RESULT: STOP`,
- `perf` prints `RESULT: CANNOT MEASURE`,
- you believe a test is wrong (report which test and why; do not ask
  `test-writer` to change it),
- you believe an audit finding is a false positive (report the rule, file,
  line and why),
- an action you need is denied by the harness (see "Denied Actions").

In the report, state which check fails, what you tried, the probable cause
(code, test, audit rule or `SPEC.md`) and what the client can do next.

### Log Files

| File | Written by | When |
|------|------------|------|
| `agent-logs/client-requests/<run>.md` | you | start of the run |
| `agent-logs/verification-logs/{syntax,lint,test,audit,build,attempt}-logs/<run>.log` | `npm run verify` | every check; never write these yourself |
| `agent-logs/verification-logs/<run>.md` | you | after every full attempt |
| `agent-logs/performance-logs/<run>.log` and `<run>/` | `npm run perf` | every measurement; never write these yourself |
| `agent-logs/development-logs/<run>.md` | you | end of the run |

Never edit or delete existing log entries in the files you write.

#### Verification Summary (`agent-logs/verification-logs/<run>.md`)

One entry per full attempt (quick checks get no entry):

- Attempt number (as printed by `verify`)
- Result of each check: passed, failed, skipped or not run
- Non-blocking audit findings by rule name (as printed by `verify`)
- For each failed check: the failing test or error in one line, and the
  change you made in response (which file, what you changed)

Do not copy raw output or the audit JSON. The last entry states the outcome:
all checks passed, or the run was stopped (after which attempt, and why).

#### Development Log (`agent-logs/development-logs/<run>.md`)

Write this file at the end of the run.

- What the task was
- Which files you created or changed
- The final result of every check
- Whether the run finished successfully or was stopped
- Open questions

#### Git

If the project is a git repository, make sure `agent-logs/` is listed in
`.gitignore`. Add it if it is missing.

### Final Report

After each completed task, give the client a short final report in the chat:
what you did, whether all checks passed, the performance results, the
`manualReview` items of `accessibility_audit`, and what is still open.
Refer to the log files by their paths.

## Accessibility

The requirements are in `SPEC.md` (N3, WCAG 2.2 level AA). Check at least the
following in every change:

- every image has a meaningful `alt` text (decorative images: `alt=""`),
- semantic HTML (headings in order, `nav`, `main`, `footer`, lists, buttons),
- every form field has a visible label,
- sufficient colour contrast (see N3 and N6),
- all functions can be used with the keyboard, with a visible focus.

`accessibility_audit` checks the source code only. Contrast, focus, keyboard
operation and the other `manualReview` items need a review in the browser.

## Security

- No secrets (API keys, passwords, tokens) in code. Use environment variables.
  The client creates `.env.local` themselves: tell them which variables are
  needed (e.g. the URL and key of the local Supabase instance).
- Validate all form input on the server, not only in the browser.
- Access to Supabase data is restricted by Row Level Security.
  Never use the service role key in code that runs in the browser.

## SEO

- Every `page.tsx` exports its own `metadata` with `title`, `description` and
  `alternates.canonical` as a relative path (e.g. `"/fussball"`).
  Next.js reads metadata only from `page.tsx` and `layout.tsx`, not from views.
- Keep `page.tsx` files as server components (no `"use client"`), because
  client components cannot export `metadata`. Put interactive parts into
  components.
- Every page has an `<h1>` (in the page itself or in its view).

## Legal Notice, Privacy Policy and Personal Data

The requirements for both pages are in `SPEC.md` (N1).

### Legal Notice (Impressum)

- If the client provides club details (name, address, board, contact,
  register entry), enter them in `lib/data/verein.ts`.
- Write missing details as placeholders in square brackets
  (e.g. `[Registernummer]`) and point them out to the client.

### Privacy Policy (Datenschutzerklärung)

- Take the details of the controller from `lib/data/verein.ts`.
- Do not invent legal bases. If you are unsure, use a placeholder in square
  brackets and point it out.
- If you add anything that processes data, point out that the privacy policy
  must be updated.

### Personal Data

- Member, application, bank or health data never appear in code or in any
  project file. They belong in the database.
- Work only with made-up test data. Do not ask for real data.
- If the client provides such data anyway, do not put it into files, do not
  repeat it, and point out this rule.

## Assets (Images, Icons, Fonts)

- Only use assets whose licence permits use. Preferred:
    - self-made SVG/CSS graphics,
    - icons from npm packages with a stated licence,
    - fonts via `next/font`.
- Do not download images or files from the internet.
- Record every file in `public/` in `ASSETS.md`: file, source, licence.
  If any of this is missing, ask the client.
- If the client asks for an asset without a known licence, do not use it.
  Point out this rule and ask for source and licence.
- For sponsor logos, see `SPEC.md` (F3).
- Use photos of people only if the client confirms that consent has been
  given. For children, parental consent is required.
- Never claim a licence yourself unless you know it from a source.

## Denied Actions

If the harness denies an action, do not try another way to do it (e.g. a
different command or tool). Stop and report (see "When to Stop").