import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData14(): FeatureData {
  return {
    id: 'item-14',
    name: stableLabel('generated feature 14'),
    group: 'group-2',
    priceCents: 4290,
    rating: 6,
  }
}
