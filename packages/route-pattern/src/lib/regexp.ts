export function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
}
