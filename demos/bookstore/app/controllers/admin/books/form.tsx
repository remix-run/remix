import { css } from 'remix/component'

import type { Book } from '../../../data/schema.ts'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { Layout } from '../../../ui/layout.tsx'

export interface AdminBookFormPageProps {
  title: string
  action: string
  cancelHref: string
  submitLabel: string
  method?: 'POST' | 'PUT'
  book?: Book
}

export function AdminBookFormPage() {
  return ({
    action,
    book,
    cancelHref,
    method = 'POST',
    submitLabel,
    title,
  }: AdminBookFormPageProps) => (
    <Layout>
      <h1>{title}</h1>

      <div class="card">
        <RestfulForm method={method} action={action} encType="multipart/form-data">
          <div class="form-group">
            <label for="title">Title</label>
            <input type="text" id="title" name="title" value={book?.title} required />
          </div>

          <div class="form-group">
            <label for="author">Author</label>
            <input type="text" id="author" name="author" value={book?.author} required />
          </div>

          <div class="form-group">
            <label for="slug">Slug (URL-friendly name)</label>
            <input type="text" id="slug" name="slug" value={book?.slug} required />
          </div>

          <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" name="description" required>
              {book?.description}
            </textarea>
          </div>

          <div class="form-group">
            <label for="price">Price</label>
            <input type="number" id="price" name="price" step="0.01" value={book?.price} required />
          </div>

          <div class="form-group">
            <label for="genre">Genre</label>
            <input type="text" id="genre" name="genre" value={book?.genre} required />
          </div>

          <div class="form-group">
            <label for="isbn">ISBN</label>
            <input type="text" id="isbn" name="isbn" value={book?.isbn} required />
          </div>

          <div class="form-group">
            <label for="publishedYear">Published Year</label>
            <input
              type="number"
              id="publishedYear"
              name="publishedYear"
              value={book?.published_year ?? 2024}
              required
            />
          </div>

          <div class="form-group">
            <label for="inStock">In Stock</label>
            <select id="inStock" name="inStock">
              <option value="true" selected={book?.in_stock ?? true}>
                Yes
              </option>
              <option value="false" selected={book != null ? !book.in_stock : false}>
                No
              </option>
            </select>
          </div>

          <div class="form-group">
            <label for="cover">Book Cover Image</label>
            {book && book.cover_url !== '/images/placeholder.jpg' ? (
              <div mix={css({ marginBottom: '0.5rem' })}>
                <img
                  src={book.cover_url}
                  alt={book.title}
                  mix={css({ maxWidth: '200px', height: 'auto', borderRadius: '4px' })}
                />
                <p mix={css({ fontSize: '0.875rem', color: '#666' })}>Current cover image</p>
              </div>
            ) : null}
            <input type="file" id="cover" name="cover" accept="image/*" />
            <small mix={css({ color: '#666' })}>
              {book
                ? 'Optional. Upload a new cover image to replace the current one.'
                : 'Optional. Upload a cover image for this book.'}
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
