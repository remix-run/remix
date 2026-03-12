import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData17(): FeatureData {
  return {
    id: 'item-17',
    name: stableLabel('generated feature 17'),
    group: 'group-1',
    priceCents: 4695,
    rating: 4,
  }
}
