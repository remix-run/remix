import * as fd from 'remix/data-schema/experimental/form'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { albums } from '../../../data/schema.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { resolveAlbumCover } from '../../../utils/album-images.ts'
import { parseId } from '../../../utils/ids.ts'
import { AdminAlbumFormPage } from './form.tsx'
import { AdminAlbumsIndexPage } from './index-page.tsx'
import { AdminAlbumForm } from './public/schema.ts'
import { AdminAlbumNotFoundPage, AdminAlbumShowPage } from './show-page.tsx'

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
          title="Add New Record"
          action={routes.admin.albums.create.href()}
          cancelHref={routes.admin.albums.index.href()}
          submitLabel="Create Record"
        />,
      )
    },

    async create({ db, formData, render }) {
      let submission = fd.parseSafe(AdminAlbumForm, formData)
      if (!submission.success) {
        return render(
          <AdminAlbumFormPage
            title="Add New Record"
            action={routes.admin.albums.create.href()}
            cancelHref={routes.admin.albums.index.href()}
            submitLabel="Create Record"
            submission={submission}
          />,
          { status: 400 },
        )
      }
      let {
        artist,
        cover,
        description,
        genre,
        inStock,
        catalogNumber,
        price,
        releaseYear,
        slug,
        title,
      } = submission.value

      await db.create(albums, {
        slug,
        title,
        artist,
        description,
        price,
        genre,
        cover_url: cover ?? '/images/placeholder.jpg',
        image_urls: JSON.stringify([]),
        catalog_number: catalogNumber,
        release_year: releaseYear,
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

      album = await resolveAlbumCover(album)

      return render(
        <AdminAlbumFormPage
          title="Edit Record"
          action={routes.admin.albums.update.href({ albumId: album.id })}
          cancelHref={routes.admin.albums.index.href()}
          submitLabel="Update Record"
          method="PUT"
          album={album}
        />,
      )
    },

    async update({ db, formData, params, render }) {
      let albumId = parseId(params.albumId)
      let album = albumId === undefined ? undefined : await db.find(albums, albumId)
      if (!album) {
        return new Response('Record not found', { status: 404 })
      }

      let submission = fd.parseSafe(AdminAlbumForm, formData)
      if (!submission.success) {
        album = await resolveAlbumCover(album)
        return render(
          <AdminAlbumFormPage
            title="Edit Record"
            action={routes.admin.albums.update.href({ albumId: album.id })}
            cancelHref={routes.admin.albums.index.href()}
            submitLabel="Update Record"
            method="PUT"
            album={album}
            submission={submission}
          />,
          { status: 400 },
        )
      }
      let {
        artist,
        cover,
        description,
        genre,
        inStock,
        catalogNumber,
        price,
        releaseYear,
        slug,
        title,
      } = submission.value
      let cover_url = cover || album.cover_url

      await db.update(albums, album.id, {
        slug,
        title,
        artist,
        description,
        price,
        genre,
        cover_url,
        catalog_number: catalogNumber,
        release_year: releaseYear,
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
