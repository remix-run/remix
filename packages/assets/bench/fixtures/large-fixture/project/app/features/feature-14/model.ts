import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData14 } from './data.ts'

export function scoreFeature14(): number {
  let data = getFeatureData14()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
