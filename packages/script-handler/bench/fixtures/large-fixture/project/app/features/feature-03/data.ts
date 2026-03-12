import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData03(): FeatureData {
  return {
    id: 'item-03',
    name: stableLabel('generated feature 03'),
    group: 'group-3',
    priceCents: 2805,
    rating: 5,
  }
}
