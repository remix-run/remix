import type { Handle } from 'remix/component'
import { Frame, attrs, css } from 'remix/component'

import type { AlbumWithCover } from '../utils/album-images.ts'
import { routes } from '../routes.ts'
import { albumCoverTransition } from './album-transitions.ts'

// Match the shared grid's 250px minimum, 24px gaps, and 1200px container.
export const albumCardImageSizes =
  '(min-width: 1200px) 272px, (min-width: 1112px) calc((100vw - 112px) / 4), (min-width: 838px) calc((100vw - 88px) / 3), (min-width: 564px) calc((100vw - 64px) / 2), calc(100vw - 40px)'

export function AlbumCoverPreload(handle: Handle<{ album: AlbumWithCover | undefined }>) {
  return () => {
    let { album } = handle.props
    return album ? (
      <link
        rel="preload"
        as="image"
        href={album.cover_url}
        imageSrcSet={album.cover_srcset}
        mix={attrs({ imagesizes: album.cover_srcset ? albumCardImageSizes : undefined })}
      />
    ) : null
  }
}

export interface AlbumCardProps {
  album: AlbumWithCover
  imageLoading?: 'eager' | 'lazy'
  imageSizes?: string
}

export function AlbumCard(handle: Handle<AlbumCardProps>) {
  return () => {
    let { album, imageLoading = 'eager', imageSizes = albumCardImageSizes } = handle.props

    return (
      <div
        data-test-slug={album.slug}
        data-album-id={album.id}
        mix={css({
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          transition: 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
          },
        })}
      >
        <a href={routes.albums.show.href({ slug: album.slug })} data-rmx-prefetch="viewport">
          <img
            src={album.cover_url}
            srcset={album.cover_srcset}
            sizes={album.cover_srcset ? imageSizes : undefined}
            alt={album.title}
            loading={imageLoading}
            mix={[
              albumCoverTransition(album.id),
              css({
                display: 'block',
                width: '100%',
                height: '300px',
                objectFit: 'cover',
                background: '#ecf0f1',
              }),
            ]}
          />
        </a>
        <div mix={css({ display: 'flex', flex: 1, flexDirection: 'column', padding: '1rem' })}>
          <h3 mix={css({ fontSize: '1.1rem', marginBottom: '0.5rem' })}>{album.title}</h3>
          <p mix={css({ color: '#7f8c8d', fontSize: '0.9rem', marginBottom: '0.5rem' })}>
            by {album.artist}
          </p>
          <p
            mix={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#27ae60',
              margin: 'auto 0 0.5rem',
              paddingTop: '0.5rem',
            })}
          >
            ${album.price.toFixed(2)}
          </p>
          <div
            mix={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.25rem',
              alignItems: 'center',
              '& .btn': {
                flex: 1,
                minWidth: 0,
                padding: '0.5rem 0.0625rem',
                fontSize: '0.6875rem',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              },
              '& [role="alert"]': { flexBasis: '100%' },
            })}
          >
            <a href={routes.albums.show.href({ slug: album.slug })} class="btn">
              View Details
            </a>

            <Frame
              name={`cart-button-${album.id}`}
              src={routes.fragments.cartButton.href({ albumId: album.id })}
            />
          </div>
        </div>
      </div>
    )
  }
}
