import type { Handle } from 'remix/ui'
import { Frame, css } from 'remix/ui'

import type { Album } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { ImageCarousel } from './public/image-carousel.tsx'
import { Layout } from '../../ui/layout.tsx'

export interface ShowPageProps {
  album: Album
  imageUrls: string[]
}

export function ShowPage(handle: Handle<ShowPageProps>) {
  return () => {
    let { album, imageUrls } = handle.props

    return (
      <Layout>
        <div mix={css({ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' })}>
          <div
            mix={css({
              aspectRatio: '1 / 1',
              borderRadius: '8px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            })}
          >
            <ImageCarousel images={imageUrls} />
          </div>

          <div class="card">
            <h1>{album.title}</h1>
            <p class="artist" mix={css({ fontSize: '1.2rem', margin: '0.5rem 0' })}>
              by {album.artist}
            </p>

            <p mix={css({ margin: '1rem 0' })}>
              <span class="badge badge-info">{album.genre}</span>
              <span
                class={`badge ${album.in_stock ? 'badge-success' : 'badge-warning'}`}
                mix={css({ marginLeft: '0.5rem' })}
              >
                {album.in_stock ? 'In Stock' : 'Out of Stock'}
              </span>
            </p>

            <p class="price" mix={css({ fontSize: '2rem', margin: '1rem 0' })}>
              ${album.price.toFixed(2)}
            </p>

            <p mix={css({ margin: '1.5rem 0', lineHeight: 1.8 })}>{album.description}</p>

            <div
              mix={css({
                margin: '1.5rem 0',
                padding: '1rem',
                background: '#f8f9fa',
                borderRadius: '4px',
              })}
            >
              <p>
                <strong>Catalog #:</strong> {album.catalog_number}
              </p>
              <p>
                <strong>Released:</strong> {album.release_year}
              </p>
            </div>

            {album.in_stock ? (
              <div mix={css({ marginTop: '2rem' })}>
                <Frame src={routes.fragments.cartButton.href({ albumId: album.id })} />
              </div>
            ) : (
              <p mix={css({ color: '#e74c3c', fontWeight: 500 })}>
                This album is currently out of stock.
              </p>
            )}

            <p mix={css({ marginTop: '1.5rem' })}>
              <a href={routes.albums.index.href()} class="btn btn-secondary">
                Back to Albums
              </a>
            </p>
          </div>
        </div>
      </Layout>
    )
  }
}

export function AlbumNotFoundPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>Album Not Found</h1>
      </div>
    </Layout>
  )
}
