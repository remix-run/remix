import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData12 } from './data.ts'

export function scoreFeature12(): number {
  let data = getFeatureData12()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
