import { createController } from 'remix/router'
import { ilike, inList, or } from 'remix/data-table'
import { createFileResponse as sendFile } from 'remix/response/file'

import { albums } from '../data/schema.ts'
import { routes } from '../routes.ts'
import { assets } from '../utils/assets.ts'
import { getCurrentCart } from '../utils/context.ts'
import { uploadsStorage } from '../utils/uploads.ts'
import { AboutPage } from './about.tsx'
import { HomePage } from './home.tsx'
import { SearchPage } from './search.tsx'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      let assetResponse = await assets.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },
    async uploads({ request, params }) {
      let file = await uploadsStorage.get(params.key)

      if (!file) {
        return new Response('File not found', { status: 404 })
      }

      return sendFile(file, request, {
        cacheControl: 'public, max-age=31536000',
      })
    },
    async home({ db, render, session }) {
      let cart = getCurrentCart(session)
      let featuredSlugs = ['flannel-overdrive', 'shred-till-dawn', 'boom-bap-boulevard']
      let featuredAlbumRows = await db.findMany(albums, {
        where: inList('slug', featuredSlugs),
      })
      let featuredAlbumsBySlug = new Map(featuredAlbumRows.map((album) => [album.slug, album]))
      let featuredAlbums = featuredSlugs.flatMap((slug) => {
        let album = featuredAlbumsBySlug.get(slug)
        return album ? [album] : []
      })

      return render(<HomePage featuredAlbums={featuredAlbums} cart={cart} />, {
        headers: { 'Cache-Control': 'no-store' },
      })
    },
    about({ render }) {
      return render(<AboutPage />)
    },
    async search({ db, render, session, url }) {
      let query = url.searchParams.get('q') ?? ''
      let matchingAlbums = query
        ? await db.findMany(albums, {
            where: or(
              ilike('title', `%${query.toLowerCase()}%`),
              ilike('artist', `%${query.toLowerCase()}%`),
              ilike('description', `%${query.toLowerCase()}%`),
            ),
            orderBy: ['id', 'asc'],
          })
        : []
      let cart = getCurrentCart(session)

      return render(<SearchPage query={query} matchingAlbums={matchingAlbums} cart={cart} />)
    },
  },
})
