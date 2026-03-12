export function titleCase(value: string): string {
  return value.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
}

export function stableLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}
