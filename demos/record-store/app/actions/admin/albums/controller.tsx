import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import * as coerce from 'remix/data-schema/coerce'
import { redirect } from 'remix/response/redirect'

import { albums } from '../../../data/schema.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { parseId } from '../../../utils/ids.ts'
import { AdminAlbumFormPage } from './form.tsx'
import { AdminAlbumsIndexPage } from './index-page.tsx'
import { AdminAlbumNotFoundPage, AdminAlbumShowPage } from './show-page.tsx'

const textField = f.field(s.defaulted(s.string(), ''))
const optionalTextField = f.field(s.optional(s.string()))
const priceField = f.field(s.defaulted(s.string(), '0'))
const releaseYearField = f.field(s.defaulted(s.string(), '2024'), {
  name: 'releaseYear',
})
const inStockField = f.field(s.defaulted(coerce.boolean(), false), {
  name: 'inStock',
})
const albumSchema = f.object({
  slug: textField,
  title: textField,
  artist: textField,
  description: textField,
  price: priceField,
  genre: textField,
  cover: optionalTextField,
  catalogNumber: textField,
  releaseYear: releaseYearField,
  inStock: inStockField,
})

export default createController(routes.admin.albums, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async index({ db, render }) {
      let allAlbums = await db.findMany(albums, { orderBy: ['id', 'asc'] })

      return render(<AdminAlbumsIndexPage albums={allAlbums} />)
    },

    async show({ db, params, render }) {
      let albumId = parseId(params.albumId)
      let album = albumId === undefined ? undefined : await db.find(albums, albumId)

      if (!album) {
        return render(<AdminAlbumNotFoundPage />, { status: 404 })
      }

      return render(<AdminAlbumShowPage album={album} />)
    },

    new({ render }) {
      return render(
        <AdminAlbumFormPage
          title="Add New Album"
          action={routes.admin.albums.create.href()}
          cancelHref={routes.admin.albums.index.href()}
          submitLabel="Create Album"
        />,
      )
    },

    async create({ db, formData }) {
      let { artist, cover, description, genre, inStock, catalogNumber, price, releaseYear, slug, title } =
        s.parse(albumSchema, formData)

      await db.create(albums, {
        slug,
        title,
        artist,
        description,
        price: parseFloat(price),
        genre,
        cover_url: cover ?? '/images/placeholder.svg',
        image_urls: JSON.stringify([]),
        catalog_number: catalogNumber,
        release_year: parseInt(releaseYear, 10),
        in_stock: inStock,
      })

      return redirect(routes.admin.albums.index.href())
    },

    async edit({ db, params, render }) {
      let albumId = parseId(params.albumId)
      let album = albumId === undefined ? undefined : await db.find(albums, albumId)

      if (!album) {
        return render(<AdminAlbumNotFoundPage />, { status: 404 })
      }

      return render(
        <AdminAlbumFormPage
          title="Edit Album"
          action={routes.admin.albums.update.href({ albumId: album.id })}
          cancelHref={routes.admin.albums.index.href()}
          submitLabel="Update Album"
          method="PUT"
          album={album}
        />,
      )
    },

    async update({ db, formData, params }) {
      let albumId = parseId(params.albumId)
      let album = albumId === undefined ? undefined : await db.find(albums, albumId)
      if (!album) {
        return new Response('Album not found', { status: 404 })
      }

      let { artist, cover, description, genre, inStock, catalogNumber, price, releaseYear, slug, title } =
        s.parse(albumSchema, formData)
      let cover_url = cover || album.cover_url

      await db.update(albums, album.id, {
        slug,
        title,
        artist,
        description,
        price: parseFloat(price),
        genre,
        cover_url,
        catalog_number: catalogNumber,
        release_year: parseInt(releaseYear, 10),
        in_stock: inStock,
      })

      return redirect(routes.admin.albums.index.href())
    },

    async destroy({ db, params }) {
      let albumId = parseId(params.albumId)
      let album = albumId === undefined ? undefined : await db.find(albums, albumId)
      if (album) {
        await db.delete(albums, album.id)
      }

      return redirect(routes.admin.albums.index.href())
    },
  },
})
