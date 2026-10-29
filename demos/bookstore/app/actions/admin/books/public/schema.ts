import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'

export const AdminBookForm = fd.object({
  slug: fd.text(s.string()),
  title: fd.text(s.string()),
  author: fd.text(s.string()),
  description: fd.text(s.string()),
  price: fd.number(s.number()),
  genre: fd.text(s.string()),
  cover: fd.text(s.optional(s.string())),
  isbn: fd.text(s.string()),
  publishedYear: fd.number(s.number()),
  inStock: fd.text(
    s.union([s.literal('true'), s.literal('false')]).transform((value) => value === 'true'),
  ),
})
