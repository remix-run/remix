import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData15 } from './data.ts'

export function scoreFeature15(): number {
  let data = getFeatureData15()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
