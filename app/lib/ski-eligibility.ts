/** Pure eligibility rules. Unknown classes are never approved automatically. */
export function eligibleForAge(description: string | null, age: "U14" | "U16"): boolean {
  const classes = (description ?? "").match(/\bU(?:12|14|16|18)\b/gi)?.map(value => value.toUpperCase()) ?? [];
  return classes.includes(age);
}
export function eligibleForPerson(description: string | null, name: string): boolean {
  if (/\belsa\b/i.test(name)) return eligibleForAge(description, "U16");
  if (/\balva\b/i.test(name)) return eligibleForAge(description, "U14");
  return false;
}
