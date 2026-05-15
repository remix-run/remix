import { applyDiscount } from '#packages/pricing/index.ts'
import { getFeatureData00 } from './data.ts'

export function scoreFeature00(): number {
  let data = getFeatureData00()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
