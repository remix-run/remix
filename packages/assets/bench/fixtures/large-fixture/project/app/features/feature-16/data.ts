import { stableLabel } from '#packages/shared/strings'

export interface FeatureData {
  id: string
  name: string
  group: string
  priceCents: number
  rating: number
}

export function getFeatureData16(): FeatureData {
  return {
    id: 'item-16',
    name: stableLabel('generated feature 16'),
    group: 'group-0',
    priceCents: 4560,
    rating: 3,
  }
}
