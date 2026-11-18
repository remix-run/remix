import * as s from 'remix/data-schema'
import * as coerce from 'remix/data-schema/coerce'
import { max, min } from 'remix/data-schema/checks'
import * as fd from 'remix/data-schema/experimental/form'

const bookId = fd.text(
  coerce.number().refine((value) => Number.isSafeInteger(value) && value > 0),
  { errorMap: () => 'Invalid book.' },
)

export const CartItemUpdateForm = fd.object({
  bookId,
  quantity: fd.number(
    s.number().pipe(min(1), max(Number.MAX_SAFE_INTEGER)).refine(Number.isSafeInteger),
    { errorMap: () => 'Invalid quantity' },
  ),
})

export const CartItemRemoveForm = fd.object({ bookId })
