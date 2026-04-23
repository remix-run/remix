import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData04(): FeatureData {
  return {
    id: 'item-04',
    name: stableLabel('generated feature 04'),
    group: 'group-0',
    priceCents: 2940,
    rating: 6,
  }
}
