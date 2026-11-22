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
- Always use the subagent `test-writer` and the verification loop described in
  "Commands". If the client asks you to skip them, decline politely.
- If something is unclear or something important is missing (e.g. data source,
  design), ask before you build.
- If sources conflict, this order applies:
    1. the rules in this file (`AGENTS.md`),
    2. `SPEC.md`,
    3. the client's prompt.

  Do not silently resolve a conflict. Point it out and ask.

## Stack

The technology stack is:

- Next.js (App Router, TypeScript)
- React
- Tailwind CSS
- Supabase

If you cannot find this stack in the project (no `package.json` that lists
`next`), stop and ask the client, if may setup the stack.

## General Rules

- Do not add new dependencies without asking first.
- Do not add external trackers, analytics or CDNs without asking first (GDPR).

## Directory Structure

| Path              | Purpose                                                                       |
|-------------------|-------------------------------------------------------------------------------|
| `app/routes/`     | Routes                                                                        |
| `app/components/` | Reusable UI components (one per file, PascalCase).                            |
| `app/services`    | Service logic for components                                                  |
| `app/view/`       | Page using components                                                         
| `app/utils`       | Logic, types and helper functions (camelCase). Every function has a test.     |
| `lib/data/`       | Sample data as constants, kept separate from logic.                           |
| `lib/supabase.ts` | The only place where the Supabase client is created. Always mock it in tests. |
| `public/`         | Static files, only those whose licence permits use (see "Assets").            |
| `agent-logs/`     | Run logs written by you (see "Logging and Final Report").                     |

Rules:

- Tests live next to the file they test (`name.test.ts`).
- Pages in `app/` import logic from `lib/`; they do not contain it.
- The legal notice (`app/impressum`) and the privacy policy (`app/datenschutz`)
  are linked in the footer of every page.
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

### Tooling

- **Strict mode:** `"strict": true` must be enabled in `tsconfig.json`
  (including `noImplicitAny` and `strictNullChecks`).

The project should use the following tools:

- [ESLint](https://eslint.org) with `@typescript-eslint/eslint-plugin` (linting)
- [Prettier](https://prettier.io) (formatting)

If these tools are not installed in the project, ask the client whether you may
install them. Do not install them without permission.

- **If the client agrees:** install and configure them, then follow their output.
- **If the client declines:** do not install them and do not ask again.
  Follow the fallback rules below instead.

#### Fallback Rules (without ESLint and Prettier)

Formatting (instead of Prettier):

- Indent with 2 spaces, no tabs.
- Follow the quote style and semicolon usage of the existing code.
- Keep lines under 100 characters where possible.
- Use trailing commas in multi-line objects, arrays and parameter lists.

Code quality (instead of ESLint):

- No unused variables, imports or parameters.
- No `console.log` in finished code.
- Always handle promises: use `await` or handle errors explicitly.
- Do not use the non-null assertion operator (`!`) to silence type errors.
- In React components, follow the rules of hooks and list all dependencies
  in `useEffect`, `useMemo` and `useCallback`.

## Testing

### Writing Tests

Tests are written only by the subagent `test-writer`. Call it before you
implement a feature or change its behaviour:

1. At the start of the run, create `agent-logs/client-requests/<run>.md` with
   the client's prompt, copied word for word, and a numbered list of the
   client's wishes (C1, C2, ...), one testable wish per item. Never change
   this file afterwards.
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
5. Implement the feature and run the verification loop (see "Commands").

If `test-writer` cannot be called, retry once. If it fails again, stop and
report. Never write tests yourself.

## Commands

### Verification Loop

After every change, run one **attempt**:

1. `npm run verify -- <run>`: runs the type check, the unit tests and, if both
   pass, the production build. It logs the full output, numbers the attempt
   and prints a short summary.
2. The `accessibility_audit` tool with `target: "app"`. It passes when its
   status is `no-findings`.
3. The `seo_audit` tool with `target: "app"`. It passes when its status is
   `no-findings`.
4. Append the attempt to the verification summary (see "Log Files").

`<run>` is the base name of this run: `YYYY-MM-DD_HH-MM_<short-task-description>`,
lowercase with hyphens, e.g. `2026-11-15_14-30_fussball-seite`. Use the same
name for every attempt and every log file of the run.

You are done when `verify` prints `RESULT: ALL PASSED` and both audits report
`no-findings`. There is no limit on attempts, but the number of steps per task
is limited. Keep the verification summary up to date after every attempt, so
it is complete even if the step limit stops you.

Use `npm run verify` for the type check, tests and build. The plain commands
are blocked.

To start the dev server: `npm run dev` (only on request; it keeps running).

### When a Problem Cannot Be Solved

Stop, change nothing more, and report to the client when:

- `verify` prints `CANNOT VERIFY`.
- You believe a test is wrong. Report which test and why. Do not ask
  `test-writer` to change it.
- An action you need is denied by the harness (see "Write Protection").

In the report, state which check fails, what you tried, the probable cause
(code, test or `SPEC.md`) and what the client can do next.

### Log Files

| File | Written by | When |
|------|------------|------|
| `agent-logs/client-requests/<run>.md` | you | start of the run |
| `agent-logs/verification-logs/{syntax,test,build}-logs/<run>.log` | `npm run verify` | every attempt; do not write these yourself |
| `agent-logs/verification-logs/<run>.md` | you | after every attempt |
| `agent-logs/development-logs/<run>.md` | you | end of the run |

Never edit or delete existing log entries.

#### Verification Summary (`agent-logs/verification-logs/<run>.md`)

After every attempt, append one entry:

- Attempt number (as printed by `verify`)
- Result of `verify` for each check: passed, failed or not run
- Status of both audits and, if there are findings, their number and rule names
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
what you did, whether all checks passed, and what is still open.
Refer to the log files by their paths.

## Accessibility

- The website must meet **WCAG 2.2, conformance level AA**
  (Web Content Accessibility Guidelines of the W3C).
- Check at least the following in every change:
    - every image has a meaningful `alt` text (decorative images: `alt=""`),
    - semantic HTML (headings in order, `nav`, `main`, `footer`, lists, buttons),
    - every form field has a visible label,
    - sufficient colour contrast (at least 4.5:1 for normal text),
    - all functions can be used with the keyboard, with a visible focus.
- Use the `accessibility_audit` tool for the automated part (see "Commands").
  It analyses the source code only. It cannot check colour contrast, visible
  focus or real keyboard operation, and it cannot evaluate dynamic props.
- In the final report, state which criteria the tool checked, which issues
  remain, and which criteria need a manual review in the browser.

## Security

- No secrets (API keys, passwords, tokens) in code. Use environment variables.
- Validate all form input on the server, not only in the browser.
- Access to Supabase data is restricted by Row Level Security.
  Never use the service role key in code that runs in the browser.

## Design and Usability

- The website is responsive and works on mobile devices first.
- Layouts must work from a screen width of 320 px up to desktop size.

## Performance Checks

The performance criteria in `SPEC.md` (N5) require a Lighthouse measurement.
Lighthouse is not installed in the project.

- Ask the client whether you may install or run Lighthouse to measure the
  performance criteria.
- **If the client agrees:** create a production build, start it, run the
  measurement, stop the server again and report the results against N5.
- **If the client declines:** do not measure. In the final report, state that
  the performance criteria have not been checked and explain how the client
  can check them:
    1. Run `npm run build` and then `npm start`.
    2. Open the website in Google Chrome.
    3. Open the developer tools (F12) and select the "Lighthouse" tab.
    4. Select "Mobile" and the category "Performance", then click "Analyze page load".
    5. Compare the results with the thresholds in `SPEC.md` (N5).
    6. Do not measure with `npm run dev`. The development mode is much slower.

## Legal Notice, Privacy Policy and Personal Data

### Legal Notice (Impressum)

- This information is public and required by law.
- If the client provides club details (name, address, board, contact,
  register entry), enter them in `lib/data/verein.ts`.
- If details are missing, use placeholders in square brackets and point this
  out. Do not invent data.

### Privacy Policy (Datenschutzerklärung)

- Create the page with the required sections. Take the details of the
  controller from `lib/data/verein.ts`.
- Only describe what the website actually does (e.g. contact form, Supabase,
  cookies). Do not invent processing activities or legal bases.
- Mark the page as a draft that must be reviewed by the club.
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
- Use sponsor logos only if the client supplies them and confirms that their
  use is permitted. Otherwise, show sponsors as text.
- Use photos of people only if the client confirms that consent has been
  given. For children, parental consent is required.
- Never claim a licence yourself unless you know it from a source.

## Write Protection

The harness blocks changes to its own files, the tests, the test setup,
`tsconfig.json`, generated folders and all `.env*` files (see `opencode.json`).
If an action is denied, do not try another way to do it (e.g. a different
command or tool). Stop and report (see "When a Problem Cannot Be Solved").

`package.json` and `package-lock.json` may only change after the client has
approved a new dependency.

## Long Tasks

keep the plan in notes/progress.md, read it first if it exists, 
otherwise create it from the spec as small steps with a check each; 
after each step run the check and update the file (ticked steps, decisions, open errors); 
update it before stopping.