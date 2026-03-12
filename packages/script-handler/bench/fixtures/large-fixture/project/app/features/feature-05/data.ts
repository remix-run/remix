import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData05(): FeatureData {
  return {
    id: 'item-05',
    name: stableLabel('generated feature 05'),
    group: 'group-1',
    priceCents: 3075,
    rating: 2,
  }
}
