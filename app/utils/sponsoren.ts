import type { Sponsor } from "@/lib/data/sponsoren";

export function hatGueltigesLogo(sponsor: Sponsor): boolean {
  const logo = sponsor.logo.trim();
  return logo.length > 0 && logo.toLowerCase().endsWith(".png");
}

export function getSponsorenMitLogos(sponsoren: Sponsor[]): Sponsor[] {
  return sponsoren.filter(hatGueltigesLogo);
}
