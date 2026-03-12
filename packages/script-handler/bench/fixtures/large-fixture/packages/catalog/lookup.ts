import { itemsById } from './items.ts'
import { stableLabel } from '../shared/strings.ts'

export interface CatalogItem {
  id: string
  name: string
  priceCents: number
}

export function lookupCatalogItem(id: string): CatalogItem {
  let item = itemsById[id]
  if (!item) throw new Error(`Unknown catalog item: ${id}`)
  return {
    ...item,
    name: stableLabel(item.name),
  }
}
