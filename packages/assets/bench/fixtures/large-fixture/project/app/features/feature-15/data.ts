import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData15(): FeatureData {
  return {
    id: 'item-15',
    name: stableLabel('generated feature 15'),
    group: 'group-3',
    priceCents: 4425,
    rating: 2,
  }
}
