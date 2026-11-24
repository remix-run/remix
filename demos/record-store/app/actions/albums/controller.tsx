import { createController } from 'remix/router'
import { and, eq, ilike, ne } from 'remix/data-table'
import * as s from 'remix/data-schema'

import { albums, albumTracks } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { getAlbumImage, resolveAlbumCover } from '../../utils/album-images.ts'
import { browsingResponseInit } from '../browsing-response.ts'
import { IndexPage } from './index-page.tsx'
import { GenreNotFoundPage, GenrePage } from './genre-page.tsx'
import { AlbumNotFoundPage, ShowPage } from './show-page.tsx'
import { RelatedAlbums } from './related-albums.tsx'

export default createController(routes.albums, {
  actions: {
    async index({ db, render, request }) {
      let allAlbums = await db.findMany(albums, { orderBy: ['id', 'asc'] })
      allAlbums = await Promise.all(allAlbums.map(resolveAlbumCover))
      let genreRows = await db
        .query(albums)
        .select('genre')
        .distinct()
        .orderBy('genre', 'asc')
        .all()

      return render(
        <IndexPage allAlbums={allAlbums} genres={genreRows.map((row) => row.genre)} />,
        browsingResponseInit(request),
      )
    },

    async genre({ db, params, render, request }) {
      let genre = params.genre
      let matchingAlbums = await db.findMany(albums, {
        where: ilike('genre', genre),
        orderBy: ['id', 'asc'],
      })

      if (matchingAlbums.length === 0) {
        return render(<GenreNotFoundPage genre={genre} />, { status: 404 })
      }

      matchingAlbums = await Promise.all(matchingAlbums.map(resolveAlbumCover))

      return render(
        <GenrePage genre={genre} matchingAlbums={matchingAlbums} />,
        browsingResponseInit(request),
      )
    },

    async show({ db, params, render, request }) {
      let rows = await db
        .query(albums)
        .leftJoin(albumTracks, eq(albums.id, albumTracks.album_id))
        .where(eq(albums.slug, params.slug))
        .select({
          ...albums,
          trackSide: albumTracks.side,
          trackPosition: albumTracks.position,
          trackTitle: albumTracks.title,
        })
        .orderBy(albumTracks.side, 'asc')
        .orderBy(albumTracks.position, 'asc')
        .all()
      let [album] = rows

      if (!album) {
        return render(<AlbumNotFoundPage />, { status: 404 })
      }

      let tracks = rows.flatMap(({ trackSide, trackPosition, trackTitle }) =>
        trackPosition === null
          ? []
          : [{ album_id: album.id, side: trackSide, position: trackPosition, title: trackTitle }],
      )
      let imageUrls = await Promise.all(
        s
          .parse(s.array(s.string()), JSON.parse(album.image_urls))
          .map((href) => getAlbumImage(href)),
      )
      let requestedImage = Number(new URL(request.url).searchParams.get('image'))
      let startIndex =
        Number.isInteger(requestedImage) && requestedImage > 0 && requestedImage <= imageUrls.length
          ? requestedImage - 1
          : 0

      return render(
        <ShowPage album={album} tracks={tracks} imageUrls={imageUrls} startIndex={startIndex} />,
        browsingResponseInit(request),
      )
    },

    async related({ db, params, render, request }) {
      let album = await db.findOne(albums, { where: { slug: params.slug } })
      if (!album) {
        return render(<p>Record not found.</p>, {
          status: 404,
          headers: { 'Cache-Control': 'no-store' },
        })
      }

      let relatedAlbums = await db.findMany(albums, {
        where: and(ilike('genre', album.genre), ne('id', album.id)),
        orderBy: ['id', 'asc'],
        limit: 3,
      })
      relatedAlbums = await Promise.all(relatedAlbums.map(resolveAlbumCover))

      return render(<RelatedAlbums albums={relatedAlbums} />, browsingResponseInit(request))
    },
  },
})
