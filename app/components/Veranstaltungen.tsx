"use client";

import { useState, useEffect } from "react";
import { VERANSTALTUNGEN } from "@/lib/data/veranstaltungen";
import {
  getTop3Veranstaltungen,
  formatiereDatum,
} from "@/app/utils/veranstaltungen";

export default function Veranstaltungen() {
  const [topEvents, setTopEvents] = useState<ReturnType<typeof getTop3Veranstaltungen>>([]);

  useEffect(() => {
    setTopEvents(getTop3Veranstaltungen(VERANSTALTUNGEN));
  }, []);

  return (
    <section
      aria-labelledby="veranstaltungen-heading"
      className="py-8 px-4"
    >
      <div className="max-w-7xl mx-auto">
        <h2
          id="veranstaltungen-heading"
          className="text-2xl font-bold text-green-800 text-center mb-6"
        >
          Kommende Veranstaltungen
        </h2>
        {topEvents.length === 0 ? (
          <p className="text-center text-gray-600">
            Derzeit sind keine kommenden Veranstaltungen geplant.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {topEvents.map((event) => (
              <article
                key={event.id}
                className="bg-white rounded-xl shadow-md p-6 border border-green-100"
              >
                <time
                  dateTime={event.datum.toISOString()}
                  className="inline-block bg-green-600 text-white text-sm font-semibold px-3 py-1 rounded-full mb-3"
                >
                  {formatiereDatum(event.datum)}
                </time>
                <h3 className="text-lg font-bold text-green-900 mb-2">
                  {event.titel}
                </h3>
                <p className="text-gray-700 text-sm line-clamp-3">
                  {event.beschreibung}
                </p>
              </article>
            ))}
          </div>
        )}
        <div className="text-center mt-6">
          <a
            href="https://example.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-green-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 transition-colors"
          >
            Alle Veranstaltungen ansehen
          </a>
        </div>
      </div>
    </section>
  );
}
