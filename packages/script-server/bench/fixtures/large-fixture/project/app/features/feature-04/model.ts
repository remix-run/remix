import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData04 } from './data.ts'

export function scoreFeature04(): number {
  let data = getFeatureData04()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
