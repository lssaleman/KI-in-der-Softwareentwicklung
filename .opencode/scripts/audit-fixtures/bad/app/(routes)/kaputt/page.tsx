import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "",
  description: "Kurz",
  alternates: { canonical: "" },
  robots: { index: false, follow: true },
};
export default function Page() {
  return (
    <main>
      <h1>Kaputt</h1>
      <script type="application/ld+json">{'{"@type": "SportsClub",}'}</script>
    </main>
  );
}
