import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData13 } from './data.ts'

export function scoreFeature13(): number {
  let data = getFeatureData13()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
