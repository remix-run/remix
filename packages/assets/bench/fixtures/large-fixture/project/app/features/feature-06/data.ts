import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData06(): FeatureData {
  return {
    id: 'item-06',
    name: stableLabel('generated feature 06'),
    group: 'group-2',
    priceCents: 3210,
    rating: 3,
  }
}
