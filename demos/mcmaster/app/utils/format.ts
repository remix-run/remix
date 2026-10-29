const priceFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const countFormat = new Intl.NumberFormat('en-US')

export function formatPrice(price: number): string {
  return priceFormat.format(price)
}

export function formatCount(count: number): string {
  return countFormat.format(count)
}
