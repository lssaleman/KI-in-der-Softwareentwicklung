# SPEC.md

**Version:** 0.1
**Last updated:** 2026-10-21
---

## 1. Purpose

A sports club needs a website to present the sports it offers in a clear
structure, to be visible online and to recruit new members. A good club website
also offers a simple way to sign up for a trial training session.

## 2. Target Groups

| Target group | Need |
|--------------|------|
| Members | Find out quickly when and where training sessions and events take place. |
| Parents | Find out when and where events take place, and see where they can help out. |
| Guests / prospective members | Sign up for a trial training session quickly, and find out where league games take place. |
| Sponsors | Find out quickly which teams play in a high league and are worth sponsoring. |
| Club board (client) | Keep content such as events and news up to date without programming knowledge, and present the club and its sponsors in a positive light. |


## 3. Functional Requirements

### F1: Start page

- **Description:** The start page is the first thing visitors see when they open
  the website, so it must be easy to understand at a glance. It presents the club
  with a banner, which usually contains pictures or videos of the club. Visitors
  must immediately see how they can join the club. Below the banner, the start
  page shows the latest club news, the upcoming events and a way to reach every
  sport the club offers.
- **Rationale:** If the start page is hard to understand, visitors leave the
  website quickly. Prospective members in particular need a direct way to join.
- **Priority:** Must
- **Acceptance criteria:**
  - [ ] The membership application form can be reached from the start page with
        one click.
  - [ ] The start page contains no more than five main sections.
  - [ ] Every sport the club offers can be reached from the start page.
  - [ ] Events are shown in chronological order, the earliest first.
  - [ ] Each event shows its name and its date in German format (DD.MM.YYYY).
  - [ ] Past events are not shown as upcoming.
  - [ ] If there are no upcoming events, a clear message is shown instead of an
        empty area.

### F2: Top bar

- **Description:** The top bar is visible to visitors on every page, so it should
  have an unobtrusive design. From the top bar, visitors can reach every subpage of
  the website, most importantly every sport the club offers. Even though every
  subpage is reachable, the menus must stay clearly structured. Only add the menus
  that are actually needed: if the club offers four sports or fewer, show them
  directly in the top bar instead of grouping them in a menu. The Top Bar should
  also have the icon of the club, which navigates the visitor back to the start page.
- **Rationale:** Visitors use the top bar to get quickly to the page that interests
  them. Without it, or with a cluttered one, they cannot find their way around.
- **Priority:** Must
- **Acceptance criteria:**
  - [ ] The top bar is shown on every page of the website.
  - [ ] Every subpage can be reached from the top bar with at most two clicks.
  - [ ] If the club offers four sports or fewer, each sport is shown directly in
        the top bar.
  - [ ] If the club offers more than four sports, they are grouped in one menu.
  - [ ] There are no empty menus and no links to pages that do not exist.
  - [ ] The page the visitor is currently on is highlighted in the top bar.
  - [ ] The club name or logo in the top bar leads back to the start page.
  - [ ] The top bar is fully usable on a screen width of 320 px.
  - [ ] All entries can be reached and opened with the keyboard, with a visible focus.
  - [ ] Club icon navigates the visitor back the start page

### F3: Sponsors

- **Description:** If a club has sponsors, they are presented on the website.
  They appear at the bottom of the page, so they do not distract visitors from
  the main content. If a sponsor has a website, visitors can click on the sponsor
  to get there.
- **Rationale:** Sponsors expect to be acknowledged on the club's website in
  return for their support. Visible acknowledgement helps the club keep its
  sponsors and win new ones.
- **Priority:** Should
- **Acceptance criteria:**
  - [ ] Every sponsor provided by the client is shown.
  - [ ] Sponsors are shown at the bottom of the page, after the main content.
  - [ ] If the club has no sponsors, no sponsor section is shown.
  - [ ] Each sponsor is shown with its logo if the client provided one and
        confirmed that it may be used. Otherwise, the sponsor's name is shown.
  - [ ] Clicking a sponsor that has a website opens that website.
  - [ ] Sponsors without a website are shown, but are not clickable.
  - [ ] Links to sponsor websites are recognisable as links to external websites.
  - [ ] Every sponsor logo has a text alternative containing the sponsor's name.
  - [ ] Sponsors are shown at the bottom of every page, after the main content.

### F4: Sport page

- **Description:** The sport page is the heart of every sport the club offers.
  It presents the department with its own texts, pictures and videos, while still
  matching the overall look and feel of the website. Besides this content, every
  sport page shows at least all teams of the department, an overview of all
  training times and, most importantly, a way to request a trial training session.
- **Rationale:** Prospective members in particular need an easy way to request a
  trial training session, because this increases the chance that they join the
  club. Members and parents need to find teams and training times quickly.
- **Priority:** Must
- **Acceptance criteria:**
  - [ ] Every sport the club offers has its own sport page.
  - [ ] Every sport page uses the same top bar, footer, colours and fonts as the
        rest of the website.
  - [ ] Every sport page has an area for the department's own texts, pictures
        and videos.
  - [ ] Every sport page lists all teams of the department.
  - [ ] Every sport page shows the training times of all teams, with day, time
        and location.
  - [ ] If a department has no teams or no training times yet, a clear message is
        shown instead of an empty area.
  - [ ] From every sport page, visitors can request a trial training session.
  - [ ] Visitors receive a confirmation after sending a trial training request.
  - [ ] If a required field in the request is missing or invalid, the visitor
        sees a clear message explaining what to correct.

### F5: Department content editing

- **Description:** Each department can update the content of its own sport page
  (texts, pictures and videos) without programming knowledge. The overall design
  of the page stays the same, so the website keeps a consistent look and feel.
- **Rationale:** Departments want to keep their page up to date themselves
  without asking the club board for every change. This keeps the information
  current and takes work off the board.
- **Priority:** Could
- **Acceptance criteria:**
  - [ ] Department members can change texts, pictures and videos on their own
        sport page without programming knowledge.
  - [ ] Department members can only change the sport page of their own department.
  - [ ] Only signed-in department members can make changes.
  - [ ] Department members cannot change the top bar, footer, colours or fonts.
  - [ ] Before a picture or video is published, the department member confirms
        that it may be used and that the people shown have given their consent.
  - [ ] Changes are visible on the website after saving.