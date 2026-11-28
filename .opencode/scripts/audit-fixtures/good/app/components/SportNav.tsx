import Link from "next/link";
interface Sport { slug: string; name: string }
export function SportNav({ sports }: { sports: Sport[] }) {
  return (
    <nav aria-label="Sportarten">
      <ul>
        {sports.map((s) => (
          <li key={s.slug}><Link href={`/${s.slug}`}>{s.name}</Link></li>
        ))}
      </ul>
    </nav>
  );
}
