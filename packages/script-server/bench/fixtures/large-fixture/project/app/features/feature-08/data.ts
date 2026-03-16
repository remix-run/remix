import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData08(): FeatureData {
  return {
    id: 'item-08',
    name: stableLabel('generated feature 08'),
    group: 'group-0',
    priceCents: 3480,
    rating: 5,
  }
}
