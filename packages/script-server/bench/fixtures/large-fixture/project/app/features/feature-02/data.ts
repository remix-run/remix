import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData02(): FeatureData {
  return {
    id: 'item-02',
    name: stableLabel('generated feature 02'),
    group: 'group-2',
    priceCents: 2670,
    rating: 4,
  }
}
