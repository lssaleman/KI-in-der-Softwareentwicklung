interface Sport { name: string; teaser: string }
export function SportView({ sport }: { sport: Sport }) {
  return <main><h1>{sport.name}</h1><p>{sport.teaser}</p></main>;
}
