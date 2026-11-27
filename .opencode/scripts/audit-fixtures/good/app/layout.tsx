import type { Metadata } from "next";
import { Logo } from "@/app/components/Logo";

export const metadata: Metadata = {
  title: { default: "TSV Musterstadt", template: "%s | TSV Musterstadt" },
  openGraph: { siteName: "TSV Musterstadt", locale: "de_DE" },
  twitter: { card: "summary" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <header>
          <Logo />
        </header>
        {children}
      </body>
    </html>
  );
}
