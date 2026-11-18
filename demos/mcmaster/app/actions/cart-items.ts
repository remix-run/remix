import * as s from 'remix/data-schema'
import { inList, type Database } from 'remix/data-table'
import type { Session } from 'remix/session'

import { familyForPart, parts, presentationForPart } from '../data/schema.ts'
import type { Part } from '../data/schema.ts'
import { getSpecColumns, getSpecValues } from '../data/specs.ts'

export interface CartItem {
  partNumber: string
  quantity: number
}

export interface CartLine extends CartItem {
  part: Part
  description: string
  total: number
}

export const maxQuantity = 999

const cartItemsSchema = s.array(s.object({ partNumber: s.string(), quantity: s.number() }))

export function getCartItems(session: Session): CartItem[] {
  let result = s.parseSafe(cartItemsSchema, session.get('cart'))
  return result.success ? result.value : []
}

export function addCartItem(items: CartItem[], partNumber: string, quantity: number): CartItem[] {
  let existing = items.find((item) => item.partNumber === partNumber)
  if (existing == null) return [...items, { partNumber, quantity }]

  return setCartItemQuantity(items, partNumber, existing.quantity + quantity)
}

export function setCartItemQuantity(
  items: CartItem[],
  partNumber: string,
  quantity: number,
): CartItem[] {
  if (quantity <= 0) return removeCartItem(items, partNumber)

  return items.map((item) =>
    item.partNumber === partNumber
      ? { partNumber, quantity: Math.min(quantity, maxQuantity) }
      : item,
  )
}

export function removeCartItem(items: CartItem[], partNumber: string): CartItem[] {
  return items.filter((item) => item.partNumber !== partNumber)
}

export async function loadCartLines(db: Database, items: CartItem[]): Promise<CartLine[]> {
  if (items.length === 0) return []

  let rows = await db.findMany(parts, {
    where: inList(
      'part_number',
      items.map((item) => item.partNumber),
    ),
    with: { family: familyForPart, presentation: presentationForPart },
  })
  let partsByNumber = new Map(rows.map((part) => [part.part_number, part]))

  return items.flatMap((item) => {
    let part = partsByNumber.get(item.partNumber)
    if (part?.family == null || part.presentation == null) return []

    let specValues = getSpecValues(part, getSpecColumns(part.family))
    let description = `${part.presentation.name} ${part.family.name}, ${specValues.join(', ')}`
    return [{ ...item, part, description, total: part.price * item.quantity }]
  })
}

export function getCartSubtotal(lines: CartLine[]): number {
  return lines.reduce((subtotal, line) => subtotal + line.total, 0)
}
