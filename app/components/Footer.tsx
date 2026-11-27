"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Footer() {
  const [currentYear, setCurrentYear] = useState<number>(2026);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="bg-green-800 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <nav aria-label="Rechtliche Informationen" className="flex flex-wrap justify-center gap-6">
          <Link
            href="/impressum"
            className="hover:underline focus:outline-none focus:ring-2 focus:ring-white rounded px-2 py-1"
          >
            Impressum
          </Link>
          <Link
            href="/datenschutz"
            className="hover:underline focus:outline-none focus:ring-2 focus:ring-white rounded px-2 py-1"
          >
            Datenschutzerklärung
          </Link>
        </nav>
        <p className="text-center text-sm mt-4 text-green-100">
          © {currentYear} Sportverein Grünwiese
        </p>
      </div>
    </footer>
  );
}
