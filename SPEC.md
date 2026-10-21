# SPEC.md

**Version:** [0.1]
**Last updated:** [2026-10-21]
---

## 1. Purpose

<!-- Why does a sports club need this website? What problem does it solve?
     2–4 sentences. -->

[Purpose of the website and the problem it solves.]

## 2. Target Groups

<!-- Who uses the website and what do they want to achieve?
     The "need" column is the WHY behind the requirements below. -->

| Target group | Need |
|--------------|------|
| [e.g. Members] | [e.g. find out quickly when and where training and events take place] |
| [Parents] | [...] |
| [Guests / prospective members] | [...] |
| [Sponsors] | [...] |
| [Club board (client)] | [...] |

## 3. Functional Requirements

<!-- One block per requirement. Number them (F1, F2, ...) so the agent and the
     tests can refer to them.
     - Description: what a visitor can see or do. Written from the visitor's view.
     - Rationale: why this matters (link to a target group).
     - Priority: Must / Should / Could.
     - Acceptance criteria: observable, testable results. No implementation. -->

### F1: [Short title]

- **Description:** [What a visitor can see or do.]
- **Rationale:** [Why this matters, for which target group.]
- **Priority:** [Must | Should | Could]
- **Acceptance criteria:**
  - [ ] [Observable result 1]
  - [ ] [Observable result 2]

<!-- Example of the intended style (delete or replace):

### F1: Upcoming events

- **Description:** Visitors see the club's upcoming events on the start page.
- **Rationale:** Members and parents need to plan their participation.
- **Priority:** Must
- **Acceptance criteria:**
  - [ ] Events are shown in chronological order, the earliest first.
  - [ ] Each event shows its name and date in German format (DD.MM.YYYY).
  - [ ] Past events are not shown as upcoming.
  - [ ] If there are no upcoming events, a clear message is shown instead
        of an empty area.
-->

### F2: [Short title]

- **Description:** [...]
- **Rationale:** [...]
- **Priority:** [...]
- **Acceptance criteria:**
  - [ ] [...]

## 4. Non-Functional Requirements

<!-- Qualities of the whole website. Number them (N1, N2, ...).
     Same structure as above. Typical areas for club websites are listed;
     remove what does not apply. -->

### N1: Legal compliance

- **Description:** [e.g. legal notice and privacy policy can be reached from every page.]
- **Rationale:** [e.g. required by German law.]
- **Acceptance criteria:**
  - [ ] [...]

### N2: Privacy

- **Description:** [...]
- **Rationale:** [...]
- **Acceptance criteria:**
  - [ ] [...]

### N3: Accessibility

- **Description:** [...]
- **Rationale:** [...]
- **Acceptance criteria:**
  - [ ] [...]

### N4: Usability and responsive design

- **Description:** [...]
- **Rationale:** [...]
- **Acceptance criteria:**
  - [ ] [...]

### N5: Performance

- **Description:** [...]
- **Rationale:** [...]
- **Acceptance criteria:**
  - [ ] [...]

### N6: Language

- **Description:** [...]
- **Rationale:** [...]
- **Acceptance criteria:**
  - [ ] [...]

## 5. Content

<!-- Which kinds of information does the website show, and what does a visitor
     need to know about each? Describe the information, not the data model. -->

| Content | Information a visitor needs | Provided by |
|---------|-----------------------------|-------------|
| [e.g. Event] | [e.g. name, date, optional location] | [Client prompt] |
| [e.g. Sponsor] | [...] | [...] |
| [e.g. Club details] | [...] | [...] |

## 6. Constraints

<!-- Conditions the solution must respect that are not features,
     e.g. legal requirements, no real personal data during development,
     licensing of images and logos. Not the stack (see AGENTS.md). -->

- [...]
- [...]

## 7. Out of Scope

<!-- What is explicitly NOT part of this version, so the agent does not build
     it on its own initiative. -->

- [e.g. Login and user accounts]
- [e.g. Role and permission management]
- [e.g. Connection to a real database]
- [...]

## 8. Open Questions

<!-- Decisions that are still open. The agent should ask instead of guessing
     when its task touches one of these. -->

| # | Question | Owner | Status |
|---|----------|-------|--------|
| Q1 | [...] | [...] | [open] |

## 9. Glossary

<!-- Club terms that the agent might misunderstand. -->

| Term | Meaning |
|------|---------|
| [e.g. Abteilung] | [a department of the club for one sport] |
| [e.g. Vorstand] | [...] |