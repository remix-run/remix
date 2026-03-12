import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData11 } from './data.ts'

export function scoreFeature11(): number {
  let data = getFeatureData11()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
