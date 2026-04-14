import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData07(): FeatureData {
  return {
    id: 'item-07',
    name: stableLabel('generated feature 07'),
    group: 'group-3',
    priceCents: 3345,
    rating: 4,
  }
}
