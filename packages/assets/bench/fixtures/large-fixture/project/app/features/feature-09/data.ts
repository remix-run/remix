import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData09(): FeatureData {
  return {
    id: 'item-09',
    name: stableLabel('generated feature 09'),
    group: 'group-1',
    priceCents: 3615,
    rating: 6,
  }
}
