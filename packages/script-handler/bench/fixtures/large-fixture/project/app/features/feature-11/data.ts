import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData11(): FeatureData {
  return {
    id: 'item-11',
    name: stableLabel('generated feature 11'),
    group: 'group-3',
    priceCents: 3885,
    rating: 3,
  }
}
