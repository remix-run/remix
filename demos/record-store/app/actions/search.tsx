import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Album } from '../data/schema.ts'
import { routes } from '../routes.ts'
import type { Cart } from '../utils/cart.ts'
import { AlbumCard } from '../ui/album-card.tsx'
import { Layout } from '../ui/layout.tsx'

interface SearchPageProps {
  query: string
  matchingAlbums: Album[]
  cart: Cart
}

export function SearchPage(handle: Handle<SearchPageProps>) {
  return () => {
    let { cart, matchingAlbums, query } = handle.props

    return (
      <Layout>
        <h1>Search Results</h1>

        <div class="card" mix={css({ marginBottom: '2rem' })}>
          <form
            action={routes.search.href()}
            method="GET"
            mix={css({ display: 'flex', gap: '0.5rem' })}
          >
            <input
              type="search"
              name="q"
              placeholder="Search albums..."
              value={query}
              mix={css({ flex: 1, padding: '0.5rem' })}
            />
            <button type="submit" class="btn">
              Search
            </button>
          </form>
        </div>

        {query ? (
          <p mix={css({ marginBottom: '1rem' })}>
            Found {matchingAlbums.length} result(s) for "{query}"
          </p>
        ) : null}

        <div class="grid">
          {matchingAlbums.length > 0 ? (
            matchingAlbums.map((album) => {
              let inCart = cart.items.some((item) => item.slug === album.slug)
              return <AlbumCard album={album} inCart={inCart} />
            })
          ) : (
            <p>No albums found matching your search.</p>
          )}
        </div>
      </Layout>
    )
  }
}
