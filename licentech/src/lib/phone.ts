// Acepta 3001234567, 573001234567 o +573001234567 y devuelve +573001234567
export function normPhone(input: string) {
  const d = input.replace(/\D/g, "");
  if (d.length === 10) return `+57${d}`;
  if (d.length === 12 && d.startsWith("57")) return `+${d}`;
  return input.trim();
}
