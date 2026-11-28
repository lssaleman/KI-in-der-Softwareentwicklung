import type { Metadata } from "next";
import { SponsorList } from "@/app/components/SponsorList";

export const metadata: Metadata = {
  title: "Sponsoren",
  description: "Diese Unternehmen unterstützen den TSV Musterstadt. Danke an alle Sponsoren und Partner des Vereins!",
  alternates: { canonical: "/sponsoren" },
};

export default function Page() {
  return (
    <main>
      <h1>Sponsoren</h1>
      <SponsorList sponsors={[]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "SportsClub", name: "TSV" }) }}
      />
    </main>
  );
}
