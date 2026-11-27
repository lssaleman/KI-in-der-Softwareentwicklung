import type { Metadata } from "next";
import Image from "next/image";
import TopBar from "@/app/components/TopBar";
import Footer from "@/app/components/Footer";
import SponsorenListe from "@/app/components/SponsorenListe";
import Veranstaltungen from "@/app/components/Veranstaltungen";

export const metadata: Metadata = {
  title: "Sportverein Grünwiese – Startseite",
  description:
    "Willkommen beim Sportverein Grünwiese. Informationen zu Mitgliedschaft, Training und Veranstaltungen.",
};

export default function Home() {
  return (
    <>
      <TopBar />
      <main className="flex-1">
        <section aria-labelledby="hero-heading" className="relative">
          <div className="relative h-64 sm:h-80 md:h-96 w-full">
            <Image
              src="/pictures/gruenwiese-startseite.jpg"
              alt="Sportverein Grünwiese – Vereinsgelände und Sportaktivitäten"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white px-4">
              <h1
                id="hero-heading"
                className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
              >
                Willkommen beim Sportverein Grünwiese
              </h1>
              <p className="text-lg sm:text-xl max-w-2xl mx-auto">
                Werden Sie Teil unserer Gemeinschaft und entdecken Sie die
                Vielfalt des Sports!
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="mitgliedschaft-heading"
          className="py-8 px-4 bg-green-50"
        >
          <div className="max-w-4xl mx-auto text-center">
            <h2
              id="mitgliedschaft-heading"
              className="text-2xl font-bold text-green-800 mb-4"
            >
              Jetzt Mitglied werden!
            </h2>
            <p className="text-gray-700 mb-6">
              Profitieren Sie von unserem vielfältigen Sportangebot und der
              tollen Gemeinschaft.
            </p>
            <a
              href="https://example.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-green-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 transition-colors"
            >
              Zur Mitgliedschaft
            </a>
          </div>
        </section>

        <Veranstaltungen />

        <section
          aria-labelledby="training-heading"
          className="py-8 px-4 bg-green-50"
        >
          <div className="max-w-4xl mx-auto">
            <h2
              id="training-heading"
              className="text-2xl font-bold text-green-800 text-center mb-6"
            >
              Training
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <a
                href="https://example.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-600 transition-shadow"
              >
                <h3 className="text-lg font-bold text-green-900 mb-2">
                  Trainingszeiten
                </h3>
                <p className="text-gray-700">
                  Alle Trainingszeiten und Orte auf einen Blick
                </p>
              </a>
              <a
                href="https://example.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-600 transition-shadow"
              >
                <h3 className="text-lg font-bold text-green-900 mb-2">
                  Probetraining
                </h3>
                <p className="text-gray-700">
                  Vereinbaren Sie ein kostenloses Probetraining
                </p>
              </a>
            </div>
          </div>
        </section>

        <SponsorenListe />
      </main>
      <Footer />
    </>
  );
}

