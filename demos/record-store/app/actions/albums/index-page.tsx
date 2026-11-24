import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { AlbumWithCover } from '../../utils/album-images.ts'
import { getAlbumGenreLabel } from '../../data/album-genres.ts'
import { routes } from '../../routes.ts'
import { AlbumCard, AlbumCoverPreload } from '../../ui/album-card.tsx'
import { AlbumSearchForm } from '../../ui/album-search-form.tsx'
import { Layout } from '../../ui/layout.tsx'

export interface IndexPageProps {
  allAlbums: AlbumWithCover[]
  genres: string[]
}

export function IndexPage(handle: Handle<IndexPageProps>) {
  return () => {
    let { allAlbums, genres } = handle.props

    return (
      <Layout head={<AlbumCoverPreload album={allAlbums[0]} />}>
        <h1>Browse Records</h1>

        <div class="card" mix={css({ marginBottom: '2rem' })}>
          <AlbumSearchForm />
        </div>

        <div class="card" mix={css({ marginBottom: '2rem' })}>
          <h3>Browse by Category</h3>
          <div mix={css({ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' })}>
            {genres.map((genre) => (
              <a
                data-rmx-prefetch="intent"
                href={routes.albums.genre.href({ genre })}
                class="btn btn-secondary"
              >
                {getAlbumGenreLabel(genre)}
              </a>
            ))}
          </div>
        </div>

        <div class="grid">
          {allAlbums.map((album, index) => (
            <AlbumCard album={album} imageLoading={index < 4 ? 'eager' : 'lazy'} />
          ))}
        </div>
      </Layout>
    )
  }
}
