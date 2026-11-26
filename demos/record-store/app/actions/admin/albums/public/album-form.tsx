import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/experimental/form'
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import type { Album } from '../../../../data/schema.ts'
import { albumGenres, getAlbumGenreLabel } from '../../../../data/album-genres.ts'
import { Field } from '../../../../ui/public/field.tsx'
import { RestfulForm } from '../../../../ui/restful-form.tsx'
import { AdminAlbumForm } from './schema.ts'

interface AdminAlbumFieldsProps {
  action: string
  cancelHref: string
  submitLabel: string
  method: 'POST' | 'PUT'
  album?: Album
  submission?: FormSubmission
}

export const AdminAlbumFields = clientEntry(
  import.meta.url,
  function AdminAlbumFields(handle: Handle<AdminAlbumFieldsProps>) {
    return () => {
      let { action, album, cancelHref, method, submitLabel, submission } = handle.props
      let submitted = submission?.values
      function restored(key: string, fallback?: string | number): string | number | undefined {
        let value = submitted?.[key]
        return typeof value === 'string' ? value : fallback
      }
      let submittedStock = submitted?.inStock
      let stock =
        typeof submittedStock === 'string'
          ? submittedStock
          : album?.in_stock === false
            ? 'false'
            : 'true'

      return (
        <form.Context id={handle.id} schema={AdminAlbumForm} submission={submission}>
          {({ fields, errors }) => (
            <RestfulForm
              method={method}
              action={action}
              encType="multipart/form-data"
              mix={form.root()}
            >
              {errors.form && <p role="alert">{errors.form.join(' ')}</p>}
              <Field
                field={fields.title}
                label="Title"
                defaultValue={restored('title', album?.title)}
              />
              <Field
                field={fields.artist}
                label="Artist"
                defaultValue={restored('artist', album?.artist)}
              />
              <Field
                field={fields.slug}
                label="Slug (URL-friendly name)"
                defaultValue={restored('slug', album?.slug)}
              />
              <Field field={fields.description} label="Description">
                <textarea
                  defaultValue={restored('description', album?.description)}
                  mix={form.control(fields.description)}
                />
              </Field>
              <Field
                field={fields.price}
                label="Price"
                defaultValue={restored('price', album?.price)}
                step="0.01"
              />
              <Field field={fields.genre} label="Category">
                <select
                  defaultValue={restored('genre', album?.genre) ?? ''}
                  mix={form.control(fields.genre)}
                >
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {albumGenres.map((genre) => (
                    <option value={genre}>{getAlbumGenreLabel(genre)}</option>
                  ))}
                </select>
              </Field>
              <Field
                field={fields.catalogNumber}
                label="Catalog Number"
                defaultValue={restored('catalogNumber', album?.catalog_number)}
              />
              <Field
                field={fields.releaseYear}
                label="Release Year"
                defaultValue={restored('releaseYear', album?.release_year ?? 2024)}
              />
              <Field field={fields.inStock} label="In Stock">
                <select defaultValue={stock} mix={form.control(fields.inStock)}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>
              <Field field={fields.cover} label="Record Cover Image">
                <>
                  {album && album.cover_url !== '/images/placeholder.jpg' && (
                    <div mix={css({ marginBottom: '0.5rem' })}>
                      <img
                        src={album.cover_url}
                        alt={album.title}
                        mix={css({ maxWidth: '200px', height: 'auto', borderRadius: '4px' })}
                      />
                      <p mix={css({ fontSize: '0.875rem', color: '#666' })}>Current cover image</p>
                    </div>
                  )}
                  <input
                    type="file"
                    id={fields.cover.id}
                    name={fields.cover.name}
                    accept="image/*"
                  />
                  <small mix={css({ color: '#666' })}>
                    {album
                      ? 'Optional. Upload a new cover image to replace the current one.'
                      : 'Optional. Upload a cover image for this record.'}
                  </small>
                </>
              </Field>
              <button type="submit" class="btn">
                {submitLabel}
              </button>
              <a
                data-rmx-prefetch="intent"
                href={cancelHref}
                class="btn btn-secondary"
                mix={css({ marginLeft: '0.5rem' })}
              >
                Cancel
              </a>
            </RestfulForm>
          )}
        </form.Context>
      )
    }
  },
)
