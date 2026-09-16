export function countWords(value: string): number {
  let words = value.trim().match(/\S+/gu)
  return words?.length ?? 0
}
