export function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`
}
