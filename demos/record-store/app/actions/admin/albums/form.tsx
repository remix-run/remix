import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Album } from '../../../data/schema.ts'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { Layout } from '../../../ui/layout.tsx'

export interface AdminAlbumFormPageProps {
  title: string
  action: string
  cancelHref: string
  submitLabel: string
  method?: 'POST' | 'PUT'
  album?: Album
}

export function AdminAlbumFormPage(handle: Handle<AdminAlbumFormPageProps>) {
  return () => {
    let { action, album, cancelHref, method = 'POST', submitLabel, title } = handle.props

    return (
      <Layout>
        <h1>{title}</h1>

        <div class="card">
          <RestfulForm method={method} action={action} encType="multipart/form-data">
            <div class="form-group">
              <label for="title">Title</label>
              <input type="text" id="title" name="title" value={album?.title} required />
            </div>

            <div class="form-group">
              <label for="artist">Artist</label>
              <input type="text" id="artist" name="artist" value={album?.artist} required />
            </div>

            <div class="form-group">
              <label for="slug">Slug (URL-friendly name)</label>
              <input type="text" id="slug" name="slug" value={album?.slug} required />
            </div>

            <div class="form-group">
              <label for="description">Description</label>
              <textarea
                id="description"
                name="description"
                required
                defaultValue={album?.description}
              />
            </div>

            <div class="form-group">
              <label for="price">Price</label>
              <input
                type="number"
                id="price"
                name="price"
                step="0.01"
                value={album?.price}
                required
              />
            </div>

            <div class="form-group">
              <label for="genre">Genre</label>
              <input type="text" id="genre" name="genre" value={album?.genre} required />
            </div>

            <div class="form-group">
              <label for="catalogNumber">Catalog #</label>
              <input type="text" id="catalogNumber" name="catalogNumber" value={album?.catalog_number} required />
            </div>

            <div class="form-group">
              <label for="releaseYear">Release Year</label>
              <input
                type="number"
                id="releaseYear"
                name="releaseYear"
                value={album?.release_year ?? 2024}
                required
              />
            </div>

            <div class="form-group">
              <label for="inStock">In Stock</label>
              <select id="inStock" name="inStock">
                <option value="true" selected={album?.in_stock ?? true}>
                  Yes
                </option>
                <option value="false" selected={album != null ? !album.in_stock : false}>
                  No
                </option>
              </select>
            </div>

            <div class="form-group">
              <label for="cover">Album Cover Image</label>
              {album && album.cover_url !== '/images/placeholder.svg' ? (
                <div mix={css({ marginBottom: '0.5rem' })}>
                  <img
                    src={album.cover_url}
                    alt={album.title}
                    mix={css({ maxWidth: '200px', height: 'auto', borderRadius: '4px' })}
                  />
                  <p mix={css({ fontSize: '0.875rem', color: '#666' })}>Current cover image</p>
                </div>
              ) : null}
              <input type="file" id="cover" name="cover" accept="image/*" />
              <small mix={css({ color: '#666' })}>
                {album
                  ? 'Optional. Upload a new cover image to replace the current one.'
                  : 'Optional. Upload a cover image for this album.'}
              </small>
            </div>

            <button type="submit" class="btn">
              {submitLabel}
            </button>
            <a href={cancelHref} class="btn btn-secondary" mix={css({ marginLeft: '0.5rem' })}>
              Cancel
            </a>
          </RestfulForm>
        </div>
      </Layout>
    )
  }
}
