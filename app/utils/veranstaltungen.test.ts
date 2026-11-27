/**
 * Tests for event utility functions.
 *
 * Covers:
 *   C6  – The 3 most recent (future) events are displayed.
 *   F1  – Events in chronological order, earliest first;
 *         German date format DD.MM.YYYY;
 *         past events not shown as upcoming;
 *         clear message when no upcoming events.
 */

import { getTop3Veranstaltungen, formatiereDatum } from "./veranstaltungen";

/* ------------------------------------------------------------------ */
/* Types – mirror the planned interface in lib/data/veranstaltungen.ts */
/* ------------------------------------------------------------------ */

interface Veranstaltung {
  id: string;
  titel: string;
  datum: Date;
  beschreibung: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Create a Veranstaltung with made-up data. */
function makeEvent(
  id: string,
  titel: string,
  year: number,
  month: number,
  day: number,
): Veranstaltung {
  return {
    id,
    titel,
    datum: new Date(year, month - 1, day),
    beschreibung: `Beschreibung für ${titel}`,
  };
}

/* ================================================================== */
/* getTop3Veranstaltungen                                              */
/* ================================================================== */

describe("getTop3Veranstaltungen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("C6 / F1: returns at most 3 events when more than 3 future events exist", () => {
    // "Now" is 1 April 2027 (Europe/Berlin)
    vi.setSystemTime(new Date(2027, 3, 1));

    const events: Veranstaltung[] = [
      makeEvent("1", "Saisonauftakt", 2027, 3, 15),   // past
      makeEvent("2", "Frühlingsfest", 2027, 4, 10),    // future
      makeEvent("3", "Handball-Cup", 2027, 5, 22),     // future
      makeEvent("4", "Sommercamp", 2027, 7, 10),       // future
      makeEvent("5", "Tag der offenen Tür", 2027, 9, 18), // future
      makeEvent("6", "Jahresabschluss", 2027, 12, 5),  // future
    ];

    const result = getTop3Veranstaltungen(events);

    expect(result).toHaveLength(3);
  });

  it("C6 / F1: returns the 3 earliest future events", () => {
    vi.setSystemTime(new Date(2027, 3, 1));

    const events: Veranstaltung[] = [
      makeEvent("1", "Saisonauftakt", 2027, 3, 15),    // past
      makeEvent("2", "Frühlingsfest", 2027, 4, 10),     // future #1
      makeEvent("3", "Handball-Cup", 2027, 5, 22),      // future #2
      makeEvent("4", "Sommercamp", 2027, 7, 10),        // future #3
      makeEvent("5", "Tag der offenen Tür", 2027, 9, 18), // future #4
    ];

    const result = getTop3Veranstaltungen(events);

    expect(result.map((e) => e.id)).toEqual(["2", "3", "4"]);
  });

  it("F1: returns events sorted chronologically, earliest first", () => {
    vi.setSystemTime(new Date(2027, 3, 1));

    // Provide events in reverse order to ensure sorting works
    const events: Veranstaltung[] = [
      makeEvent("4", "Sommercamp", 2027, 7, 10),
      makeEvent("3", "Handball-Cup", 2027, 5, 22),
      makeEvent("2", "Frühlingsfest", 2027, 4, 10),
    ];

    const result = getTop3Veranstaltungen(events);

    expect(result[0].datum.getTime()).toBeLessThanOrEqual(result[1].datum.getTime());
    expect(result[1].datum.getTime()).toBeLessThanOrEqual(result[2].datum.getTime());
  });

  it("F1: excludes past events", () => {
    vi.setSystemTime(new Date(2027, 5, 1)); // 1 June 2027

    const events: Veranstaltung[] = [
      makeEvent("past1", "Altes Fest", 2027, 3, 15),
      makeEvent("past2", "Letztes Turnier", 2027, 4, 20),
      makeEvent("future1", "Sommercamp", 2027, 7, 10),
    ];

    const result = getTop3Veranstaltungen(events);

    const ids = result.map((e) => e.id);
    expect(ids).not.toContain("past1");
    expect(ids).not.toContain("past2");
    expect(ids).toContain("future1");
  });

  it("F1: returns empty array when no events are provided", () => {
    vi.setSystemTime(new Date(2027, 3, 1));

    const result = getTop3Veranstaltungen([]);

    expect(result).toEqual([]);
  });

  it("F1: returns empty array when all events are in the past", () => {
    vi.setSystemTime(new Date(2028, 0, 1)); // 1 Jan 2028

    const events: Veranstaltung[] = [
      makeEvent("1", "Old Event 1", 2027, 3, 15),
      makeEvent("2", "Old Event 2", 2027, 7, 10),
      makeEvent("3", "Old Event 3", 2027, 12, 5),
    ];

    const result = getTop3Veranstaltungen(events);

    expect(result).toEqual([]);
  });

  it("C6: returns all events when fewer than 3 future events exist", () => {
    vi.setSystemTime(new Date(2027, 3, 1));

    const events: Veranstaltung[] = [
      makeEvent("1", "Only Event", 2027, 5, 22),
      makeEvent("2", "Second Event", 2027, 7, 10),
    ];

    const result = getTop3Veranstaltungen(events);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("2");
  });

  it("C6: returns exactly 3 when exactly 3 future events exist", () => {
    vi.setSystemTime(new Date(2027, 3, 1));

    const events: Veranstaltung[] = [
      makeEvent("1", "Event A", 2027, 4, 10),
      makeEvent("2", "Event B", 2027, 5, 22),
      makeEvent("3", "Event C", 2027, 7, 10),
    ];

    const result = getTop3Veranstaltungen(events);

    expect(result).toHaveLength(3);
  });

  it("F1: does not count an event on today as past (Europe/Berlin)", () => {
    // Set now to 10 April 2027 10:00 Europe/Berlin
    // An event at date 10 April 2027 should be considered "today" and thus future/upcoming
    vi.setSystemTime(new Date(2027, 3, 10, 8, 0, 0)); // 10 April 08:00 UTC ≈ 10:00 Berlin

    const events: Veranstaltung[] = [
      makeEvent("today", "Heute Event", 2027, 4, 10),
      makeEvent("tomorrow", "Morgen Event", 2027, 4, 11),
    ];

    const result = getTop3Veranstaltungen(events);

    const ids = result.map((e) => e.id);
    expect(ids).toContain("today");
    expect(ids).toContain("tomorrow");
  });

  it("edge case: handles events with the same date", () => {
    vi.setSystemTime(new Date(2027, 3, 1));

    const events: Veranstaltung[] = [
      makeEvent("a", "Event A", 2027, 5, 22),
      makeEvent("b", "Event B", 2027, 5, 22),
      makeEvent("c", "Event C", 2027, 5, 22),
      makeEvent("d", "Event D", 2027, 5, 22),
    ];

    const result = getTop3Veranstaltungen(events);

    // All have the same date, so all are valid; at most 3 should be returned
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.length).toBeGreaterThan(0);
  });

  it("edge case: does not mutate the input array", () => {
    vi.setSystemTime(new Date(2027, 3, 1));

    const events: Veranstaltung[] = [
      makeEvent("3", "Third", 2027, 7, 10),
      makeEvent("1", "First", 2027, 4, 10),
      makeEvent("2", "Second", 2027, 5, 22),
    ];

    const originalOrder = events.map((e) => e.id);
    getTop3Veranstaltungen(events);

    expect(events.map((e) => e.id)).toEqual(originalOrder);
  });
});

/* ================================================================== */
/* formatiereDatum                                                     */
/* ================================================================== */

describe("formatiereDatum", () => {
  it("F1: formats a date in German format DD.MM.YYYY", () => {
    const datum = new Date(2027, 2, 15); // 15 March 2027

    const result = formatiereDatum(datum);

    expect(result).toBe("15.03.2027");
  });

  it("F1: adds leading zero for single-digit day", () => {
    const datum = new Date(2027, 4, 5); // 5 May 2027

    const result = formatiereDatum(datum);

    expect(result).toBe("05.05.2027");
  });

  it("F1: adds leading zero for single-digit month", () => {
    const datum = new Date(2027, 0, 20); // 20 January 2027

    const result = formatiereDatum(datum);

    expect(result).toBe("20.01.2027");
  });

  it("F1: adds leading zeros for both single-digit day and month", () => {
    const datum = new Date(2027, 1, 3); // 3 February 2027

    const result = formatiereDatum(datum);

    expect(result).toBe("03.02.2027");
  });

  it("edge case: last day of the year", () => {
    const datum = new Date(2027, 11, 31); // 31 December 2027

    const result = formatiereDatum(datum);

    expect(result).toBe("31.12.2027");
  });

  it("edge case: first day of the year", () => {
    const datum = new Date(2028, 0, 1); // 1 January 2028

    const result = formatiereDatum(datum);

    expect(result).toBe("01.01.2028");
  });
});
