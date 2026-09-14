import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Album } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export function AdminAlbumNotFoundPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>Album Not Found</h1>
      </div>
    </Layout>
  )
}

export function AdminAlbumShowPage(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props

    return (
      <Layout>
        <h1>Album Details</h1>

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
            <strong>Genre:</strong> {album.genre}
          </p>
          <p>
            <strong>Catalog #:</strong> {album.catalog_number}
          </p>
          <p>
            <strong>Released:</strong> {album.release_year}
          </p>
          <p>
            <strong>In Stock:</strong>{' '}
            <span class={`badge ${album.in_stock ? 'badge-success' : 'badge-warning'}`}>
              {album.in_stock ? 'Yes' : 'No'}
            </span>
          </p>

          <div mix={css({ marginTop: '2rem' })}>
            <a href={routes.admin.albums.edit.href({ albumId: album.id })} class="btn">
              Edit
            </a>
            <a
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
