import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData06 } from './data.ts'

export function scoreFeature06(): number {
  let data = getFeatureData06()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
