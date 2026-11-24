import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { AlbumWithCover } from '../utils/album-images.ts'
import { AlbumCard, AlbumCoverPreload } from '../ui/album-card.tsx'
import { AlbumSearchForm } from '../ui/album-search-form.tsx'
import { Layout } from '../ui/layout.tsx'

interface SearchPageProps {
  query: string
  matchingAlbums: AlbumWithCover[]
}

export function SearchPage(handle: Handle<SearchPageProps>) {
  return () => {
    let { matchingAlbums, query } = handle.props

    return (
      <Layout head={<AlbumCoverPreload album={matchingAlbums[0]} />}>
        <h1>Search Results</h1>

        <div class="card" mix={css({ marginBottom: '2rem' })}>
          <AlbumSearchForm query={query} />
        </div>

        {query ? (
          <p mix={css({ marginBottom: '1rem' })}>
            Found {matchingAlbums.length} result(s) for "{query}"
          </p>
        ) : null}

        <div class="grid">
          {matchingAlbums.length > 0 ? (
            matchingAlbums.map((album, index) => (
              <AlbumCard album={album} imageLoading={index < 4 ? 'eager' : 'lazy'} />
            ))
          ) : (
            <p>No records found matching your search.</p>
          )}
        </div>
      </Layout>
    )
  }
}
