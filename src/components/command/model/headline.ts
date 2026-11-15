// Headline card (Lucas, L52): one line on load — how many people sit in
// High or Critical cells today or tomorrow (lead-analysis places.json
// people_high, an estimate) and the municipality with the most.
import type { Place, Places } from "./places";

export function headlineFor(p: Places): { text: string; top: Place; people: number } | undefined {
  const withPeople = p.places.filter((x) => (x.peopleHigh ?? 0) > 0);
  if (!withPeople.length) return undefined;
  const people = withPeople.reduce((s, x) => s + (x.peopleHigh ?? 0), 0);
  const top = withPeople.reduce((a, b) => ((b.peopleHigh ?? 0) > (a.peopleHigh ?? 0) ? b : a));
  const n = Math.round(people).toLocaleString("en-US");
  return { text: `Today & tomorrow: ${n} people in High or Critical risk areas · most in ${top.name} (${top.uf})`, top, people };
}
