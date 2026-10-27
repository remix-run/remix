import * as form from '@remix-run/ui/form'
import type { FormSubmission } from 'remix/data-schema/form'
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import type { Book } from '../../../../data/schema.ts'
import { Field } from '../../../../ui/public/field.tsx'
import { RestfulForm } from '../../../../ui/restful-form.tsx'
import { AdminBookForm } from './schema.ts'

interface AdminBookFieldsProps {
  action: string
  cancelHref: string
  submitLabel: string
  method: 'POST' | 'PUT'
  book?: Book
  submission?: FormSubmission
}

export const AdminBookFields = clientEntry(
  import.meta.url,
  function AdminBookFields(handle: Handle<AdminBookFieldsProps>) {
    return () => {
      let { action, book, cancelHref, method, submitLabel, submission } = handle.props
      let submitted = submission?.values
      function restored(key: string, fallback?: string | number): string | number | undefined {
        let value = submitted?.[key]
        return typeof value === 'string' ? value : fallback
      }
      let submittedStock = submitted?.inStock
      let stock =
        typeof submittedStock === 'string'
          ? submittedStock
          : book?.in_stock === false
            ? 'false'
            : 'true'

      return (
        <form.Context id={handle.id} schema={AdminBookForm} submission={submission}>
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
                input={{ defaultValue: restored('title', book?.title) }}
              />
              <Field
                field={fields.author}
                label="Author"
                input={{ defaultValue: restored('author', book?.author) }}
              />
              <Field
                field={fields.slug}
                label="Slug (URL-friendly name)"
                input={{ defaultValue: restored('slug', book?.slug) }}
              />
              <Field field={fields.description} label="Description">
                <textarea
                  defaultValue={restored('description', book?.description)}
                  mix={form.control(fields.description)}
                />
              </Field>
              <Field
                field={fields.price}
                label="Price"
                input={{ defaultValue: restored('price', book?.price), step: '0.01' }}
              />
              <Field
                field={fields.genre}
                label="Genre"
                input={{ defaultValue: restored('genre', book?.genre) }}
              />
              <Field
                field={fields.isbn}
                label="ISBN"
                input={{ defaultValue: restored('isbn', book?.isbn) }}
              />
              <Field
                field={fields.publishedYear}
                label="Published Year"
                input={{ defaultValue: restored('publishedYear', book?.published_year ?? 2024) }}
              />
              <Field field={fields.inStock} label="In Stock">
                <select mix={form.control(fields.inStock)}>
                  <option value="true" selected={stock === 'true'}>
                    Yes
                  </option>
                  <option value="false" selected={stock === 'false'}>
                    No
                  </option>
                </select>
              </Field>
              <Field field={fields.cover} label="Book Cover Image">
                <>
                  {book && book.cover_url !== '/images/placeholder.jpg' && (
                    <div mix={css({ marginBottom: '0.5rem' })}>
                      <img
                        src={book.cover_url}
                        alt={book.title}
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
                    {book
                      ? 'Optional. Upload a new cover image to replace the current one.'
                      : 'Optional. Upload a cover image for this book.'}
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
