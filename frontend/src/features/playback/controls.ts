export function controlValue(
  text: string,
  current: number,
  min: number,
  max: number,
  integer = false,
) {
  if (!text.trim() || !Number.isFinite(Number(text))) return current;
  const value = integer ? Math.round(Number(text)) : Number(text);
  return Math.max(min, Math.min(max, value));
}
export function tempoBounds(base: number) {
  return { min: Math.max(20, base * 0.25), max: Math.min(400, base * 2) };
}
