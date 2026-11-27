import type { Metadata } from "next";
import TopBar from "@/app/components/TopBar";
import Footer from "@/app/components/Footer";
import { VEREIN } from "@/lib/data/verein";

export const metadata: Metadata = {
  title: "Impressum – Sportverein Grünwiese",
  description: "Rechtliche Informationen zum Sportverein Grünwiese.",
};

export default function ImpressumPage() {
  return (
    <>
      <TopBar />
      <main className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-green-800 mb-6">Impressum</h1>

          <section aria-labelledby="verein-name" className="mb-6">
            <h2 id="verein-name" className="text-xl font-semibold mb-2">
              Angaben zum Verein
            </h2>
            <p>{VEREIN.name}</p>
            <p>
              {VEREIN.adresse.strasse}
              <br />
              {VEREIN.adresse.plz} {VEREIN.adresse.ort}
            </p>
          </section>

          <section aria-labelledby="vertretung" className="mb-6">
            <h2 id="vertretung" className="text-xl font-semibold mb-2">
              Vertretungsberechtigte
            </h2>
            <ul className="list-disc pl-6">
              <li>Vorsitzender: {VEREIN.vorstand.vorsitzender}</li>
              <li>Stellvertreter: {VEREIN.vorstand.stellvertreter}</li>
              <li>Kassenwart: {VEREIN.vorstand.kassenwart}</li>
            </ul>
          </section>

          <section aria-labelledby="kontakt" className="mb-6">
            <h2 id="kontakt" className="text-xl font-semibold mb-2">
              Kontakt
            </h2>
            <p>Telefon: {VEREIN.kontakt.telefon}</p>
            <p>E-Mail: {VEREIN.kontakt.email}</p>
          </section>

          <section aria-labelledby="register" className="mb-6">
            <h2 id="register" className="text-xl font-semibold mb-2">
              Registereintrag
            </h2>
            <p>Registergericht: {VEREIN.registergericht}</p>
            <p>Registernummer: {VEREIN.registernummer}</p>
          </section>

          <section aria-labelledby="hinweis" className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Hinweis:</strong> Die Angaben in eckigen Klammern sind
              Platzhalter und müssen vom Verein ergänzt werden.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
