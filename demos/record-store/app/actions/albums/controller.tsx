import { createController } from 'remix/router'
import { ilike } from 'remix/data-table'

import { albums } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { getCurrentCart } from '../../utils/context.ts'
import { IndexPage } from './index-page.tsx'
import { GenreNotFoundPage, GenrePage } from './genre-page.tsx'
import { AlbumNotFoundPage, ShowPage } from './show-page.tsx'

export default createController(routes.albums, {
  actions: {
    async index({ db, render, session }) {
      let allAlbums = await db.findMany(albums, { orderBy: ['id', 'asc'] })
      let genreRows = await db.query(albums).select('genre').distinct().orderBy('genre', 'asc').all()
      let cart = getCurrentCart(session)

      return render(
        <IndexPage allAlbums={allAlbums} genres={genreRows.map((row) => row.genre)} cart={cart} />,
      )
    },

    async genre({ db, params, render, session }) {
      let genre = params.genre
      let matchingAlbums = await db.findMany(albums, {
        where: ilike('genre', genre),
        orderBy: ['id', 'asc'],
      })

      if (matchingAlbums.length === 0) {
        return render(<GenreNotFoundPage genre={genre} />, { status: 404 })
      }

      let cart = getCurrentCart(session)

      return render(<GenrePage genre={genre} matchingAlbums={matchingAlbums} cart={cart} />)
    },

    async show({ db, params, render }) {
      let album = await db.findOne(albums, { where: { slug: params.slug } })

      if (!album) {
        return render(<AlbumNotFoundPage />, { status: 404 })
      }

      let imageUrls = JSON.parse(album.image_urls) as string[]

      return render(<ShowPage album={album} imageUrls={imageUrls} />, {
        headers: { 'Cache-Control': 'no-store' },
      })
    },
  },
})
