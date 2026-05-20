import { applyDiscount } from '#packages/pricing/index.ts'
import { getFeatureData05 } from './data.ts'

export function scoreFeature05(): number {
  let data = getFeatureData05()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
