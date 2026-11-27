import Image from "next/image";
import { SPONSOREN } from "@/lib/data/sponsoren";
import { getSponsorenMitLogos } from "@/app/utils/sponsoren";

export default function SponsorenListe() {
  const sponsorenMitLogos = getSponsorenMitLogos(SPONSOREN);

  if (sponsorenMitLogos.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="sponsoren-heading"
      className="bg-green-50 py-8 px-4"
    >
      <div className="max-w-7xl mx-auto">
        <h2
          id="sponsoren-heading"
          className="text-2xl font-bold text-green-800 text-center mb-6"
        >
          Unsere Partner und Sponsoren
        </h2>
        <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-8">
          {sponsorenMitLogos.map((sponsor) => {
            if (sponsor.website) {
              return (
                <a
                  key={sponsor.name}
                  href={sponsor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center p-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <Image
                    src={sponsor.logo}
                    alt={`Logo ${sponsor.name} – Externe Webseite öffnen`}
                    width={120}
                    height={60}
                    className="object-contain h-12 sm:h-16 w-auto"
                  />
                </a>
              );
            }

            return (
              <div
                key={sponsor.name}
                className="flex items-center justify-center p-2 bg-white rounded-lg shadow-sm"
              >
                <Image
                  src={sponsor.logo}
                  alt={`Logo ${sponsor.name}`}
                  width={120}
                  height={60}
                  className="object-contain h-12 sm:h-16 w-auto"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
