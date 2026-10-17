// Normalize international phone input to E.164; callers validate country-code and length.
export function normPhone(input: string) {
  const trimmed = input.trim();
  const normalized = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  return `+${normalized.slice(1).replace(/\D/g, "")}`;
}
