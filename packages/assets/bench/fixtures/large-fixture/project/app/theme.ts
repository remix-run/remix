export const palette = {
  background: '#0f172a',
  foreground: '#e2e8f0',
  accent: '#38bdf8',
  muted: '#94a3b8',
}

export function sectionTone(index: number): string {
  return index % 2 === 0 ? palette.background : '#111827'
}
