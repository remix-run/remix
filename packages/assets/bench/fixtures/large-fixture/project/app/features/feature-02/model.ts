import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData02 } from './data.ts'

export function scoreFeature02(): number {
  let data = getFeatureData02()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
