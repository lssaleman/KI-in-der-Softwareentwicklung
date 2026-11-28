interface Sponsor { name: string; url: string }
export function SponsorList({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <ul>
      {sponsors.map((s) => (
        <li key={s.name}><a href={s.url} rel="noopener noreferrer" target="_blank">{s.name} (externe Website)</a></li>
      ))}
    </ul>
  );
}
