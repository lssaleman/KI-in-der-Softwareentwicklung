import type { Metadata } from "next";
import { SportView } from "@/app/view/SportView";
import { getSport } from "@/app/services/sports";
export async function generateMetadata({ params }: { params: Promise<{ sport: string }> }): Promise<Metadata> {
  const { sport } = await params;
  const s = await getSport(sport);
  return { title: s.name, description: s.teaser, alternates: { canonical: `/${sport}` } };
}
export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  return <SportView sport={await getSport(sport)} />;
}
