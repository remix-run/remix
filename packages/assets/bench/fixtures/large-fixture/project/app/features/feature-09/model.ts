import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData09 } from './data.ts'

export function scoreFeature09(): number {
  let data = getFeatureData09()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
