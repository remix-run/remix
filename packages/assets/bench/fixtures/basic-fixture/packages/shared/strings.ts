export function stableLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase()
}
