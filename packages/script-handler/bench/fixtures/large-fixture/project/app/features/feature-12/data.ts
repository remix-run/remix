import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData12(): FeatureData {
  return {
    id: 'item-12',
    name: stableLabel('generated feature 12'),
    group: 'group-0',
    priceCents: 4020,
    rating: 4,
  }
}
