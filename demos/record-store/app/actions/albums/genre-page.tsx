import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Album } from '../../data/schema.ts'
import type { Cart } from '../../utils/cart.ts'
import { routes } from '../../routes.ts'
import { AlbumCard } from '../../ui/album-card.tsx'
import { Layout } from '../../ui/layout.tsx'

export interface GenrePageProps {
  genre: string
  matchingAlbums: Album[]
  cart: Cart
}

export function GenrePage(handle: Handle<GenrePageProps>) {
  return () => {
    let { cart, genre, matchingAlbums } = handle.props

    return (
      <Layout>
        <h1>{genre.charAt(0).toUpperCase() + genre.slice(1)} Albums</h1>
        <p mix={css({ margin: '1rem 0' })}>
          <a href={routes.albums.index.href()} class="btn btn-secondary">
            View All Albums
          </a>
        </p>

        <div class="grid" mix={css({ marginTop: '2rem' })}>
          {matchingAlbums.map((album) => {
            let inCart = cart.items.some((item) => item.slug === album.slug)
            return <AlbumCard album={album} inCart={inCart} />
          })}
        </div>
      </Layout>
    )
  }
}

export function GenreNotFoundPage(handle: Handle<{ genre: string }>) {
  return () => (
    <Layout>
      <div class="card">
        <h1>Genre Not Found</h1>
        <p>No albums found in the "{handle.props.genre}" genre.</p>
        <p mix={css({ marginTop: '1rem' })}>
          <a href={routes.albums.index.href()} class="btn">
            Browse All Albums
          </a>
        </p>
      </div>
    </Layout>
  )
}
