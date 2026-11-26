import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { AlbumWithCover } from '../../utils/album-images.ts'
import { getAlbumGenreLabel } from '../../data/album-genres.ts'
import { routes } from '../../routes.ts'
import { AlbumCard, AlbumCoverPreload } from '../../ui/album-card.tsx'
import { Layout } from '../../ui/layout.tsx'

export interface GenrePageProps {
  genre: string
  matchingAlbums: AlbumWithCover[]
}

export function GenrePage(handle: Handle<GenrePageProps>) {
  return () => {
    let { genre, matchingAlbums } = handle.props

    return (
      <Layout head={<AlbumCoverPreload album={matchingAlbums[0]} />}>
        <h1>{getAlbumGenreLabel(genre)}</h1>
        <p mix={css({ margin: '1rem 0' })}>
          <a data-rmx-prefetch="intent" href={routes.albums.index.href()} class="btn btn-secondary">
            View All Records
          </a>
        </p>

        <div class="grid" mix={css({ marginTop: '2rem' })}>
          {matchingAlbums.map((album, index) => (
            <AlbumCard album={album} imageLoading={index < 4 ? 'eager' : 'lazy'} />
          ))}
        </div>
      </Layout>
    )
  }
}

export function GenreNotFoundPage(handle: Handle<{ genre: string }>) {
  return () => (
    <Layout>
      <div class="card">
        <h1>Category Not Found</h1>
        <p>No records found in the "{handle.props.genre}" category.</p>
        <p mix={css({ marginTop: '1rem' })}>
          <a data-rmx-prefetch="intent" href={routes.albums.index.href()} class="btn">
            Browse All Records
          </a>
        </p>
      </div>
    </Layout>
  )
}
