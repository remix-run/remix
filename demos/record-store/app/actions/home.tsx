import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { AlbumWithCover } from '../utils/album-images.ts'
import { routes } from '../routes.ts'
import { AlbumCard, AlbumCoverPreload } from '../ui/album-card.tsx'
import { Layout } from '../ui/layout.tsx'

interface HomePageProps {
  featuredAlbums: AlbumWithCover[]
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { featuredAlbums } = handle.props

    return (
      <Layout head={<AlbumCoverPreload album={featuredAlbums[0]} />}>
        <div class="card">
          <h1>Welcome to the Record Store</h1>
          <p mix={css({ margin: '1rem 0' })}>
            Browse the catalog to find your next favorite record.
          </p>
          <p>
            <a data-rmx-prefetch="intent" href={routes.albums.index.href()} class="btn">
              Browse Records
            </a>
          </p>
        </div>

        <h2 mix={css({ margin: '2rem 0 1rem' })}>Featured Records</h2>
        <div class="grid">
          {featuredAlbums.map((album) => (
            <AlbumCard album={album} />
          ))}
        </div>
      </Layout>
    )
  }
}
