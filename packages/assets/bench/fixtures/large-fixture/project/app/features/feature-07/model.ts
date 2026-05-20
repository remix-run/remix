import { applyDiscount } from '#packages/pricing/index.ts'
import { getFeatureData07 } from './data.ts'

export function scoreFeature07(): number {
  let data = getFeatureData07()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
