import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData10(): FeatureData {
  return {
    id: 'item-10',
    name: stableLabel('generated feature 10'),
    group: 'group-2',
    priceCents: 3750,
    rating: 2,
  }
}
