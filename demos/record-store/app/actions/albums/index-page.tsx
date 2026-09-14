import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Album } from '../../data/schema.ts'
import type { Cart } from '../../utils/cart.ts'
import { routes } from '../../routes.ts'
import { AlbumCard } from '../../ui/album-card.tsx'
import { Layout } from '../../ui/layout.tsx'

export interface IndexPageProps {
  allAlbums: Album[]
  genres: string[]
  cart: Cart
}

export function IndexPage(handle: Handle<IndexPageProps>) {
  return () => {
    let { allAlbums, cart, genres } = handle.props

    return (
      <Layout>
        <h1>Browse Albums</h1>

        <div class="card" mix={css({ marginBottom: '2rem' })}>
          <form
            action={routes.search.href()}
            method="GET"
            mix={css({ display: 'flex', gap: '0.5rem' })}
          >
            <input
              type="search"
              name="q"
              placeholder="Search albums by title, artist, or description..."
              mix={css({ flex: 1, padding: '0.5rem' })}
            />
            <button type="submit" class="btn">
              Search
            </button>
          </form>
        </div>

        <div class="card" mix={css({ marginBottom: '2rem' })}>
          <h3>Browse by Genre</h3>
          <div mix={css({ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' })}>
            {genres.map((genre) => (
              <a href={routes.albums.genre.href({ genre })} class="btn btn-secondary">
                {genre}
              </a>
            ))}
          </div>
        </div>

        <div class="grid">
          {allAlbums.map((album) => {
            let inCart = cart.items.some((item) => item.slug === album.slug)
            return <AlbumCard album={album} inCart={inCart} />
          })}
        </div>
      </Layout>
    )
  }
}
