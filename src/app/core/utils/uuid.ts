export function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
