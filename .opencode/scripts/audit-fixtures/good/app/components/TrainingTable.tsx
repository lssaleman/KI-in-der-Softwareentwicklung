interface Slot { day: string; time: string; place: string }
export function TrainingTable({ slots }: { slots: Slot[] }) {
  return (
    <section aria-labelledby="training-heading">
      <h2 id="training-heading">Trainingszeiten</h2>
      <table>
        <thead><tr><th scope="col">Tag</th><th scope="col">Uhrzeit</th><th scope="col">Ort</th></tr></thead>
        <tbody>{slots.map((s) => <tr key={s.day + s.time}><td>{s.day}</td><td>{s.time}</td><td>{s.place}</td></tr>)}</tbody>
      </table>
    </section>
  );
}
