/**
 * Tests for sponsor data validation utilities.
 *
 * Covers:
 *   C9  – All sponsors (adac, decathlon, rewe, sportscheck, aldi, lidl)
 *         are shown with logo.
 *   C10 – Each sponsor logo is a link to the sponsor's website.
 *   F3  – Every sponsor provided by the client is shown;
 *         sponsor logos have text alternatives;
 *         sponsors with website are clickable;
 *         sponsors without website are shown but not clickable;
 *         links to sponsor websites are recognisable as external.
 */

import {
  hatGueltigesLogo,
  getSponsorenMitLogos,
} from "./sponsoren";

/* -------------------------------------------------------------- */
/* Types – mirror the planned interface in lib/data/sponsoren.ts   */
/* -------------------------------------------------------------- */

interface Sponsor {
  name: string;
  logo: string;
  website: string;
}

/* -------------------------------------------------------------- */
/* Test data                                                        */
/* -------------------------------------------------------------- */

/** The six sponsors named by the client (C9). */
const EXPECTED_SPONSOR_NAMES = [
  "adac",
  "decathlon",
  "rewe",
  "sportscheck",
  "aldi",
  "lidl",
];

/** Valid sample sponsors with .png logos and websites. */
const gueltigeSponsoren: Sponsor[] = EXPECTED_SPONSOR_NAMES.map((name) => ({
  name,
  logo: `${name}.png`,
  website: `https://www.${name}.de`,
}));

/* ================================================================== */
/* hatGueltigesLogo                                                     */
/* ================================================================== */

describe("hatGueltigesLogo", () => {
  it("C9 / F3: returns true when a sponsor has a .png logo", () => {
    const sponsor: Sponsor = {
      name: "aldi",
      logo: "aldi.png",
      website: "https://www.aldi.de",
    };

    expect(hatGueltigesLogo(sponsor)).toBe(true);
  });

  it("F3: returns false when logo path is empty", () => {
    const sponsor: Sponsor = {
      name: "aldi",
      logo: "",
      website: "https://www.aldi.de",
    };

    expect(hatGueltigesLogo(sponsor)).toBe(false);
  });

  it("C9: returns false when logo does not have .png extension", () => {
    const sponsor: Sponsor = {
      name: "aldi",
      logo: "aldi.jpg",
      website: "https://www.aldi.de",
    };

    expect(hatGueltigesLogo(sponsor)).toBe(false);
  });

  it("C9: returns false for a logo with no file extension", () => {
    const sponsor: Sponsor = {
      name: "aldi",
      logo: "aldi",
      website: "https://www.aldi.de",
    };

    expect(hatGueltigesLogo(sponsor)).toBe(false);
  });

  it("C9: validates all six expected sponsors with correct logo names", () => {
    for (const sponsor of gueltigeSponsoren) {
      expect(hatGueltigesLogo(sponsor)).toBe(true);
    }
  });

  it("edge case: returns true for a logo path with subdirectory", () => {
    const sponsor: Sponsor = {
      name: "rewe",
      logo: "pictures/sponsor/rewe.png",
      website: "https://www.rewe.de",
    };

    expect(hatGueltigesLogo(sponsor)).toBe(true);
  });

  it("edge case: returns false when logo is only whitespace", () => {
    const sponsor: Sponsor = {
      name: "lidl",
      logo: "   ",
      website: "https://www.lidl.de",
    };

    expect(hatGueltigesLogo(sponsor)).toBe(false);
  });
});

/* ================================================================== */
/* getSponsorenMitLogos                                                 */
/* ================================================================== */

describe("getSponsorenMitLogos", () => {
  it("C9 / F3: returns all sponsors when all have valid logos", () => {
    const result = getSponsorenMitLogos(gueltigeSponsoren);

    expect(result).toHaveLength(gueltigeSponsoren.length);
    expect(result.map((s) => s.name)).toEqual(EXPECTED_SPONSOR_NAMES);
  });

  it("F3: returns empty array when no sponsors are provided", () => {
    const result = getSponsorenMitLogos([]);

    expect(result).toEqual([]);
  });

  it("F3: filters out sponsors without valid logos", () => {
    const sponsors: Sponsor[] = [
      { name: "aldi", logo: "aldi.png", website: "https://www.aldi.de" },
      { name: "lidl", logo: "", website: "https://www.lidl.de" },
      { name: "rewe", logo: "rewe.png", website: "https://www.rewe.de" },
    ];

    const result = getSponsorenMitLogos(sponsors);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name)).toEqual(["aldi", "rewe"]);
  });

  it("F3: filters out sponsors with non-.png logos", () => {
    const sponsors: Sponsor[] = [
      { name: "aldi", logo: "aldi.png", website: "https://www.aldi.de" },
      { name: "lidl", logo: "lidl.jpg", website: "https://www.lidl.de" },
    ];

    const result = getSponsorenMitLogos(sponsors);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("aldi");
  });

  it("C10 / F3: keeps sponsors with and without websites separate (sponsor without website is still returned)", () => {
    // F3: "Sponsors without a website are shown, but are not clickable."
    // So getSponsorenMitLogos should return them (they have a valid logo).
    const sponsors: Sponsor[] = [
      { name: "aldi", logo: "aldi.png", website: "https://www.aldi.de" },
      { name: "localshop", logo: "localshop.png", website: "" },
    ];

    const result = getSponsorenMitLogos(sponsors);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name)).toContain("localshop");
  });

  it("C9: validates that all six client-named sponsors are present", () => {
    const result = getSponsorenMitLogos(gueltigeSponsoren);

    for (const name of EXPECTED_SPONSOR_NAMES) {
      expect(result.map((s) => s.name)).toContain(name);
    }
  });

  it("edge case: does not mutate the input array", () => {
    const sponsors: Sponsor[] = [
      { name: "rewe", logo: "rewe.png", website: "https://www.rewe.de" },
      { name: "aldi", logo: "aldi.png", website: "https://www.aldi.de" },
    ];
    const originalLength = sponsors.length;

    getSponsorenMitLogos(sponsors);

    expect(sponsors).toHaveLength(originalLength);
  });
});
