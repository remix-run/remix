export function applyDiscount(priceCents: number, score: number): number {
  let discount = Math.min(score * 17, 340)
  return Math.max(priceCents - discount, 500)
}
