import { applyDiscount } from '#packages/pricing/index'
import { getFeatureData03 } from './data.ts'

export function scoreFeature03(): number {
  let data = getFeatureData03()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
