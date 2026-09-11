import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Album } from '../data/schema.ts'
import { routes } from '../routes.ts'
import type { Cart } from '../utils/cart.ts'
import { AlbumCard } from '../ui/album-card.tsx'
import { Layout } from '../ui/layout.tsx'

interface HomePageProps {
  featuredAlbums: Album[]
  cart: Cart
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { featuredAlbums, cart } = handle.props

    return (
      <Layout>
        <div class="card">
          <h1>Welcome to the Record Store</h1>
          <p mix={css({ margin: '1rem 0' })}>
            Dig through the crates for your next favorite album — grunge, hip-hop, metal, ska, and
            more.
          </p>
          <p>
            <a href={routes.albums.index.href()} class="btn">
              Browse Albums
            </a>
          </p>
        </div>

        <h2 mix={css({ margin: '2rem 0 1rem' })}>Featured Albums</h2>
        <div class="grid">
          {featuredAlbums.map((album) => {
            let inCart = cart.items.some((item) => item.slug === album.slug)
            return <AlbumCard album={album} inCart={inCart} />
          })}
        </div>
      </Layout>
    )
  }
}
