import { css } from 'remix/component'

import type { Book } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export function AdminBookNotFoundPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>Book Not Found</h1>
      </div>
    </Layout>
  )
}

export function AdminBookShowPage() {
  return ({ book }: { book: Book }) => (
    <Layout>
      <h1>Book Details</h1>

      <div class="card">
        <p>
          <strong>Title:</strong> {book.title}
        </p>
        <p>
          <strong>Author:</strong> {book.author}
        </p>
        <p>
          <strong>Slug:</strong> {book.slug}
        </p>
        <p>
          <strong>Description:</strong> {book.description}
        </p>
        <p>
          <strong>Price:</strong> ${book.price.toFixed(2)}
        </p>
        <p>
          <strong>Genre:</strong> {book.genre}
        </p>
        <p>
          <strong>ISBN:</strong> {book.isbn}
        </p>
        <p>
          <strong>Published:</strong> {book.published_year}
        </p>
        <p>
          <strong>In Stock:</strong>{' '}
          <span class={`badge ${book.in_stock ? 'badge-success' : 'badge-warning'}`}>
            {book.in_stock ? 'Yes' : 'No'}
          </span>
        </p>

        <div mix={css({ marginTop: '2rem' })}>
          <a href={routes.admin.books.edit.href({ bookId: book.id })} class="btn">
            Edit
          </a>
          <a
            href={routes.admin.books.index.href()}
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
