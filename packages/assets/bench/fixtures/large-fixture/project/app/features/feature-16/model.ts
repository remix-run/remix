import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData16 } from './data.ts'

export function scoreFeature16(): number {
  let data = getFeatureData16()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
