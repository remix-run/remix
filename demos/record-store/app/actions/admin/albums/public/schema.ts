import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/experimental/form'

import { albumGenres } from '../../../../data/album-genres.ts'

export const AdminAlbumForm = fd.object({
  slug: fd.text(s.string()),
  title: fd.text(s.string()),
  artist: fd.text(s.string()),
  description: fd.text(s.string()),
  price: fd.number(s.number()),
  genre: fd.text(s.enum_(albumGenres)),
  cover: fd.text(s.optional(s.string())),
  catalogNumber: fd.text(s.string()),
  releaseYear: fd.number(s.number()),
  inStock: fd.text(
    s.union([s.literal('true'), s.literal('false')]).transform((value) => value === 'true'),
  ),
})
