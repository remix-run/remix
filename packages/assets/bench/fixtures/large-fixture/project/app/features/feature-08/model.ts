import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData08 } from './data.ts'

export function scoreFeature08(): number {
  let data = getFeatureData08()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
