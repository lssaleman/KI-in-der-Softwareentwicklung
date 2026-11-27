import type { Veranstaltung } from "@/lib/data/veranstaltungen";

export function getTop3Veranstaltungen(
  veranstaltungen: Veranstaltung[]
): Veranstaltung[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  return veranstaltungen
    .filter((v) => v.datum >= todayStart)
    .sort((a, b) => a.datum.getTime() - b.datum.getTime())
    .slice(0, 3);
}

export function formatiereDatum(datum: Date): string {
  const day = String(datum.getDate()).padStart(2, "0");
  const month = String(datum.getMonth() + 1).padStart(2, "0");
  const year = datum.getFullYear();
  return `${day}.${month}.${year}`;
}
