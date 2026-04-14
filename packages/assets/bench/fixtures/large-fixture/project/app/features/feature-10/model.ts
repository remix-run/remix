import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData10 } from './data.ts'

export function scoreFeature10(): number {
  let data = getFeatureData10()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
