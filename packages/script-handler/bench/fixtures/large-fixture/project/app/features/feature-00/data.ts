import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData00(): FeatureData {
  return {
    id: 'item-00',
    name: stableLabel('generated feature 00'),
    group: 'group-0',
    priceCents: 2400,
    rating: 2,
  }
}
