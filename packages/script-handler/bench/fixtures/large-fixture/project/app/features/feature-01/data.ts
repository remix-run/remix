import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData01(): FeatureData {
  return {
    id: 'item-01',
    name: stableLabel('generated feature 01'),
    group: 'group-1',
    priceCents: 2535,
    rating: 3,
  }
}
