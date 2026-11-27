import Image from "next/image";
import Link from "next/link";

const MENU_LINKS = [
  { label: "Der Verein", href: "https://example.com", external: true },
  { label: "Der Vorstand", href: "https://example.com", external: true },
  { label: "Die Mitgliedschaft", href: "https://example.com", external: true },
  { label: "Aktuelles", href: "https://example.com", external: true },
  { label: "Training", href: "https://example.com", external: true },
];

export default function TopBar() {
  return (
    <header className="bg-green-700 text-white sticky top-0 z-50 shadow-md">
      <nav
        className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3"
        aria-label="Hauptnavigation"
      >
          <Link
            href="/"
            className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-white rounded-lg"
          >
          <Image
            src="/pictures/logo.jpg"
            alt="Logo Sportverein Grünwiese"
            width={48}
            height={48}
            className="rounded-full"
            priority
          />
          <span className="text-xl font-bold hidden sm:inline">
            SV Grünwiese
          </span>
        </Link>
        <ul className="flex flex-wrap items-center gap-2 sm:gap-4">
          {MENU_LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-white transition-colors text-sm sm:text-base"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
