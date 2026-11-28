"use client";
import { useId } from "react";
export function TrialForm() {
  const nameId = useId();
  return (
    <form>
      <label htmlFor={nameId}>Name</label>
      <input id={nameId} name="name" required />
      <label>E-Mail <input type="email" name="email" required /></label>
      <button type="submit">Probetraining anfragen</button>
    </form>
  );
}
