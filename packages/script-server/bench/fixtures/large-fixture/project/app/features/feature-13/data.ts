import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData13(): FeatureData {
  return {
    id: 'item-13',
    name: stableLabel('generated feature 13'),
    group: 'group-1',
    priceCents: 4155,
    rating: 5,
  }
}
