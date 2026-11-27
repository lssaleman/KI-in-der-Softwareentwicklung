import type { Metadata } from "next";
import TopBar from "@/app/components/TopBar";
import Footer from "@/app/components/Footer";
import { VEREIN } from "@/lib/data/verein";

export const metadata: Metadata = {
  title: "Datenschutzerklärung – Sportverein Grünwiese",
  description: "Datenschutzerklärung des Sportverein Grünwiese.",
};

export default function DatenschutzPage() {
  return (
    <>
      <TopBar />
      <main className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-green-800 mb-6">
            Datenschutzerklärung
          </h1>

          <section className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Hinweis:</strong> Dies ist ein Entwurf, der vom Verein
              geprüft und angepasst werden muss.
            </p>
          </section>

          <section aria-labelledby="verantwortlich" className="mb-6">
            <h2 id="verantwortlich" className="text-xl font-semibold mb-2">
              Verantwortlicher
            </h2>
            <p>{VEREIN.name}</p>
            <p>
              {VEREIN.adresse.strasse}
              <br />
              {VEREIN.adresse.plz} {VEREIN.adresse.ort}
            </p>
            <p>Telefon: {VEREIN.kontakt.telefon}</p>
            <p>E-Mail: {VEREIN.kontakt.email}</p>
          </section>

          <section aria-labelledby="datenverarbeitung" className="mb-6">
            <h2 id="datenverarbeitung" className="text-xl font-semibold mb-2">
              Datenverarbeitung
            </h2>
            <p className="mb-2">
              Diese Website verarbeitet personenbezogene Daten nur, wenn dies
              zur Bereitstellung einer funktionsfähigen Website erforderlich
              ist.
            </p>
            <h3 className="font-semibold mt-4 mb-2">Erhobene Daten</h3>
            <ul className="list-disc pl-6">
              <li>
                Technisch notwendige Daten (z.B. IP-Adresse, Browser-Typ) für
                den Betrieb der Website
              </li>
            </ul>
          </section>

          <section aria-labelledby="rechte" className="mb-6">
            <h2 id="rechte" className="text-xl font-semibold mb-2">
              Ihre Rechte
            </h2>
            <p className="mb-2">Sie haben das Recht auf:</p>
            <ul className="list-disc pl-6">
              <li>Auskunft über Ihre gespeicherten Daten</li>
              <li>Berichtigung unrichtiger Daten</li>
              <li>Löschung Ihrer Daten</li>
              <li>Einschränkung der Verarbeitung</li>
              <li>Datenübertragbarkeit</li>
              <li>Widerspruch gegen die Verarbeitung</li>
            </ul>
          </section>

          <section aria-labelledby="kontakt-datenschutz" className="mb-6">
            <h2 id="kontakt-datenschutz" className="text-xl font-semibold mb-2">
              Kontakt
            </h2>
            <p>
              Bei Fragen zum Datenschutz wenden Sie sich bitte an:{" "}
              {VEREIN.kontakt.email}
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
