import type { Handle } from 'remix/component'
import { Frame, attrs, css } from 'remix/component'

import type { Album } from '../../data/schema.ts'
import type { AlbumImage } from '../../utils/album-images.ts'
import { getAlbumGenreLabel } from '../../data/album-genres.ts'
import { routes } from '../../routes.ts'
import { ImageCarousel, faceoutImageSizes } from './public/image-carousel.tsx'
import { Layout } from '../../ui/layout.tsx'

export interface ShowPageProps {
  album: Album
  imageUrls: AlbumImage[]
  startIndex: number
}

export function ShowPage(handle: Handle<ShowPageProps>) {
  return () => {
    let { album, imageUrls, startIndex } = handle.props
    let mainImage = imageUrls[startIndex]

    return (
      <Layout
        head={
          mainImage ? (
            <link
              rel="preload"
              as="image"
              href={mainImage.src}
              imageSrcSet={mainImage.srcSet}
              mix={attrs({ imagesizes: mainImage.srcSet ? faceoutImageSizes : undefined })}
            />
          ) : null
        }
      >
        <div
          mix={css({
            display: 'grid',
            gridTemplateColumns: '300px minmax(0, 1fr)',
            gap: '2rem',
            '@media (max-width: 768px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
          })}
        >
          <div
            class="card"
            mix={css({
              gridColumn: 2,
              position: 'relative',
              minHeight: '300px',
              '@media (max-width: 768px)': { gridColumn: 1 },
            })}
          >
            <h1>{album.title}</h1>
            <p class="artist" mix={css({ fontSize: '1.2rem', margin: '0.5rem 0' })}>
              by {album.artist}
            </p>

            <p mix={css({ margin: '1rem 0' })}>
              <span class="badge badge-info">{getAlbumGenreLabel(album.genre)}</span>
              <span
                class={`badge ${album.in_stock ? 'badge-success' : 'badge-warning'}`}
                mix={css({ marginLeft: '0.5rem' })}
              >
                {album.in_stock ? 'In Stock' : 'Out of Stock'}
              </span>
            </p>

            <div
              mix={css({
                // Keep one carousel mounted as it moves into the card on small screens.
                position: 'absolute',
                top: 0,
                left: 'calc(-300px - 2rem)',
                width: '300px',
                '@media (max-width: 768px)': {
                  position: 'relative',
                  left: 'auto',
                  width: '100%',
                  maxWidth: '300px',
                  margin: '1rem 0',
                },
              })}
            >
              <ImageCarousel albumId={album.id} images={imageUrls} startIndex={startIndex} />
            </div>

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
                <strong>Catalog Number:</strong> {album.catalog_number}
              </p>
              <p>
                <strong>Release Year:</strong> {album.release_year}
              </p>
            </div>

            {album.in_stock ? (
              <div mix={css({ marginTop: '2rem' })}>
                <Frame
                  name={`cart-button-${album.id}`}
                  src={routes.fragments.cartButton.href({ albumId: album.id })}
                />
              </div>
            ) : (
              <p mix={css({ color: '#e74c3c', fontWeight: 500 })}>
                This record is currently out of stock.
              </p>
            )}

            <p mix={css({ marginTop: '1.5rem' })}>
              <a
                data-rmx-prefetch="intent"
                href={routes.albums.index.href()}
                class="btn btn-secondary"
              >
                Back to Records
              </a>
            </p>
          </div>
          <section
            class="card"
            aria-labelledby="related-albums-heading"
            mix={css({
              gridColumn: 2,
              minWidth: 0,
              '@media (max-width: 768px)': { gridColumn: 1 },
            })}
          >
            <h2 id="related-albums-heading" mix={css({ marginBottom: '1.5rem' })}>
              Related Records
            </h2>
            <Frame
              name={`related-albums-${album.id}`}
              src={routes.albums.related.href({ slug: album.slug })}
              loading="lazy"
              fallback={
                <div
                  mix={css({
                    minHeight: '450px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  })}
                >
                  <p role="status">Loading related records…</p>
                  <a href={routes.albums.genre.href({ genre: album.genre })}>
                    Browse this category
                  </a>
                </div>
              }
            />
          </section>
        </div>
      </Layout>
    )
  }
}

export function AlbumNotFoundPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>Record Not Found</h1>
      </div>
    </Layout>
  )
}
