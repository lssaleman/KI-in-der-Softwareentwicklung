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
- Never run `git commit` or `git push`.

## Directory Structure

| Path              | Purpose                                                              |
|-------------------|----------------------------------------------------------------------|
| `app/routes/`     | Routes            |
| `app/components/` | Reusable UI components (one per file, PascalCase).                   |
| `app/services`    | Service logic for components                                         |
| `app/view/`       | Page using components
| `app/utils`       | Logic, types and helper functions (camelCase). Every function has a test. |
| `lib/data/`       | Sample data as constants, kept separate from logic.                  |
| `lib/supabase.ts` | The only place where the Supabase client is created. Always mock it in tests. |
| `public/`         | Static files, only those whose licence permits use (see "Assets"). |
| `agent-logs/`     | Run logs written by you (see "Logging and Final Report").            |

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

- Tests are written with Vitest and run with `npm test`. The test setup
  (`vitest.config.ts` and the `test` script in `package.json`) is provided.
  Do not install another test runner and do not change the test configuration.
  If `npm test` is missing, stop and ask.
- Every function in `app/utils/` and `lib/` has a test.
- Tests live next to the file they test (`name.test.ts`) and import
  `describe`, `it`, `expect` and `vi` from `vitest`.
- Mock `lib/supabase.ts` with `vi.mock()` in every test that uses it.
  Tests never connect to a real database.
- Test edge cases, not only the normal case. For this domain, at least:
  - empty lists (no events, no sponsors),
  - past events,
  - time zones (the club is located in Germany, time zone `Europe/Berlin`),
  - German date format (`DD.MM.YYYY`).

## Commands

Run these checks in this order after every change.
You are only done when all three pass.

1. `npx tsc --noEmit` — type and syntax check
2. `npm test` — unit tests with Vitest (runs once, no watch mode)
3. The `accessibility_audit` tool with `target: "app"` — static accessibility
   check. It passes when the report contains no issues.

Run tests only via `npm test`. Do not call `npx vitest` directly.

If a check still fails after 5 attempts, stop. Do not keep trying.
Report what fails and what the client can try next.

To start the dev server: `npm run dev` (only on request; it keeps running).

## Logging and Final Report

### Log File

At the end of every run, write one log file to `agent-logs/`.

- **File name:** `YYYY-MM-DD_HH-MM_<short-task-description>.md`,
  e.g. `2026-10-21_13-45_startseite-termine-sponsoren.md`.
  Use lowercase and hyphens in the description.
- **Content:** what the task was, which files you created or changed, the
  results of the commands from "Commands", and any open questions.
- **Git:** if the project is a git repository, make sure `agent-logs/` is
  listed in `.gitignore`. Add it if it is missing.

### Final Report

After each completed task, give the client a short final report in the chat:
what you did, whether all commands passed, and what is still open.
Refer to the log file by its path.

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

## Protected Files

Do not change, delete or move these files and folders. If a task seems to
require it, stop and ask.

| Path | Reason |
|------|--------|
| `AGENTS.md`, `SPEC.md` | Written by the team; they define your rules and requirements. |
| `opencode.json`, `.opencode/` | Harness configuration and custom tools. |
| `package.json` dependencies, `package-lock.json` | Change only after the client approved a new dependency. |
| `tsconfig.json` | Strict mode must stay enabled. |
| `node_modules/`, `.next/` | Generated by npm and Next.js. |
| `agent-logs/` | Add new log files only. Never edit or delete existing ones. |
| `vitest.config.ts` | Test setup provided by the harness. |

Do not open, read or create `.env`, `.env.local` or any other `.env*` file.
They may contain secrets, and everything you read is sent to the model provider.