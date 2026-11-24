import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { Album } from '../data/schema.ts'
import { routes } from '../routes.ts'
import { AlbumCard } from '../ui/album-card.tsx'
import { Layout } from '../ui/layout.tsx'

interface SearchPageProps {
  query: string
  matchingAlbums: Album[]
}

export function SearchPage(handle: Handle<SearchPageProps>) {
  return () => {
    let { matchingAlbums, query } = handle.props

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
              placeholder="Search records..."
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
            matchingAlbums.map((album) => <AlbumCard album={album} />)
          ) : (
            <p>No records found matching your search.</p>
          )}
        </div>
      </Layout>
    )
  }
}
