
import { describe, it, expect, vi, afterEach } from "vitest";

import {
  getVisibleSponsors,
  rotateSponsors,
  shouldRotateSponsors,
  startSponsorRotation,
  stopSponsorRotation,
  pauseSponsorRotation,
  resumeSponsorRotation,
} from "@/app/utils/sponsoren";

import type { Sponsor } from "@/app/lib/data/sponsoren";

const sponsors: Sponsor[] = [
  { name: "A", logo: "/a.png", website: "https://a.de" },
  { name: "B", logo: "/b.png", website: "https://b.de" },
  { name: "C", logo: "/c.png", website: "https://c.de" },
  { name: "D", logo: "/d.png", website: "https://d.de" },
  { name: "E", logo: "/e.png", website: "https://e.de" },
];

describe("Sponsoren-Rotation", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("getVisibleSponsors", () => {
    it("zeigt maximal die konfigurierte Anzahl an Sponsoren", () => {
      expect(getVisibleSponsors(sponsors, 3, 0))
        .toEqual(sponsors.slice(0, 3));
    });

    it("berücksichtigt den aktuellen Index", () => {
      expect(getVisibleSponsors(sponsors, 3, 2))
        .toEqual([sponsors[2], sponsors[3], sponsors[4]]);
    });

    it("rotiert am Listenende zyklisch weiter", () => {
      expect(getVisibleSponsors(sponsors, 3, 4))
        .toEqual([sponsors[4], sponsors[0], sponsors[1]]);
    });

    it("gibt bei einer leeren Liste ein leeres Array zurück", () => {
      expect(getVisibleSponsors([], 3, 0)).toEqual([]);
    });

    it("zeigt bei weniger Sponsoren alle vorhandenen an", () => {
      expect(getVisibleSponsors(sponsors.slice(0, 2), 3, 0))
        .toEqual(sponsors.slice(0, 2));
    });
  });

  describe("rotateSponsors", () => {
    it("wechselt zum nächsten Index", () => {
      expect(rotateSponsors(0, 5, 3)).toBe(1);
    });

    it("beginnt nach dem letzten Index wieder bei null", () => {
      expect(rotateSponsors(4, 5, 3)).toBe(0);
    });

    it("rotiert bei weniger Sponsoren nicht", () => {
      expect(rotateSponsors(0, 2, 3)).toBe(0);
    });
  });

  describe("shouldRotateSponsors", () => {
    it("aktiviert Rotation bei mehr Sponsoren als sichtbaren Plätzen", () => {
      expect(shouldRotateSponsors(5, 3)).toBe(true);
    });

    it("deaktiviert Rotation bei gleicher Anzahl", () => {
      expect(shouldRotateSponsors(3, 3)).toBe(false);
    });

    it("deaktiviert Rotation bei weniger Sponsoren", () => {
      expect(shouldRotateSponsors(2, 3)).toBe(false);
    });

    it("deaktiviert Rotation bei leerer Liste", () => {
      expect(shouldRotateSponsors(0, 3)).toBe(false);
    });
  });

  describe("startSponsorRotation und stopSponsorRotation", () => {
    it("führt den Callback regelmäßig aus", () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      const timer = startSponsorRotation(callback, 3000);

      vi.advanceTimersByTime(9000);

      expect(callback).toHaveBeenCalledTimes(3);

      stopSponsorRotation(timer);
    });

    it("stoppt den Timer vollständig", () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      const timer = startSponsorRotation(callback, 3000);

      stopSponsorRotation(timer);
      vi.advanceTimersByTime(9000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("pauseSponsorRotation und resumeSponsorRotation", () => {
    it("pausiert die Rotation", () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      const timer = startSponsorRotation(callback, 3000);

      pauseSponsorRotation();
      vi.advanceTimersByTime(6000);

      expect(callback).not.toHaveBeenCalled();

      stopSponsorRotation(timer);
    });

    it("setzt die Rotation nach einer Pause fort", () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      const timer = startSponsorRotation(callback, 3000);

      pauseSponsorRotation();
      vi.advanceTimersByTime(6000);

      resumeSponsorRotation();
      vi.advanceTimersByTime(3000);

      expect(callback).toHaveBeenCalledTimes(1);

      stopSponsorRotation(timer);
    });
  });
});
