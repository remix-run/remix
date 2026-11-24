import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { Album } from '../../../data/schema.ts'
import { getAlbumGenreLabel } from '../../../data/album-genres.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export function AdminAlbumNotFoundPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>Record Not Found</h1>
      </div>
    </Layout>
  )
}

export function AdminAlbumShowPage(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props

    return (
      <Layout>
        <h1>Record Details</h1>

        <div class="card">
          <p>
            <strong>Title:</strong> {album.title}
          </p>
          <p>
            <strong>Artist:</strong> {album.artist}
          </p>
          <p>
            <strong>Slug:</strong> {album.slug}
          </p>
          <p>
            <strong>Description:</strong> {album.description}
          </p>
          <p>
            <strong>Price:</strong> ${album.price.toFixed(2)}
          </p>
          <p>
            <strong>Category:</strong> {getAlbumGenreLabel(album.genre)}
          </p>
          <p>
            <strong>Catalog Number:</strong> {album.catalog_number}
          </p>
          <p>
            <strong>Release Year:</strong> {album.release_year}
          </p>
          <p>
            <strong>In Stock:</strong>{' '}
            <span class={`badge ${album.in_stock ? 'badge-success' : 'badge-warning'}`}>
              {album.in_stock ? 'Yes' : 'No'}
            </span>
          </p>

          <div mix={css({ marginTop: '2rem' })}>
            <a
              data-rmx-prefetch="intent"
              href={routes.admin.albums.edit.href({ albumId: album.id })}
              class="btn"
            >
              Edit
            </a>
            <a
              data-rmx-prefetch="intent"
              href={routes.admin.albums.index.href()}
              class="btn btn-secondary"
              mix={css({ marginLeft: '0.5rem' })}
            >
              Back to List
            </a>
          </div>
        </div>
      </Layout>
    )
  }
}
