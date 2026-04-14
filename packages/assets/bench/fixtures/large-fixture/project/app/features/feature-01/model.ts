import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData01 } from './data.ts'

export function scoreFeature01(): number {
  let data = getFeatureData01()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
