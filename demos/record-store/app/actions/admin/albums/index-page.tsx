import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Album } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { Layout } from '../../../ui/layout.tsx'

export function AdminAlbumsIndexPage(handle: Handle<{ albums: Album[] }>) {
  return () => {
    let { albums } = handle.props

    return (
      <Layout>
        <h1>Manage Albums</h1>

        <p mix={css({ marginBottom: '1rem' })}>
          <a href={routes.admin.albums.new.href()} class="btn">
            Add New Album
          </a>
          <a
            href={routes.admin.index.href()}
            class="btn btn-secondary"
            mix={css({ marginLeft: '0.5rem' })}
          >
            Back to Dashboard
          </a>
        </p>

        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Artist</th>
                <th>Genre</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {albums.map((album) => (
                <tr>
                  <td>{album.title}</td>
                  <td>{album.artist}</td>
                  <td>{album.genre}</td>
                  <td>${album.price.toFixed(2)}</td>
                  <td>
                    <span class={`badge ${album.in_stock ? 'badge-success' : 'badge-warning'}`}>
                      {album.in_stock ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td class="actions">
                    <a
                      href={routes.admin.albums.edit.href({ albumId: album.id })}
                      class="btn btn-secondary"
                      mix={css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })}
                    >
                      Edit
                    </a>
                    <RestfulForm
                      method="DELETE"
                      action={routes.admin.albums.destroy.href({ albumId: album.id })}
                      mix={css({ display: 'inline' })}
                    >
                      <button
                        type="submit"
                        class="btn btn-danger"
                        mix={css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })}
                      >
                        Delete
                      </button>
                    </RestfulForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Layout>
    )
  }
}
