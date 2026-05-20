import { applyDiscount } from '#packages/pricing/index.ts'
import { getFeatureData17 } from './data.ts'

export function scoreFeature17(): number {
  let data = getFeatureData17()
  return applyDiscount(data.priceCents, data.rating + data.group.length)
}
