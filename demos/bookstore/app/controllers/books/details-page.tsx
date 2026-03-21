import { Frame, css } from 'remix/component'

import type { Book } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { ImageCarousel } from '../../assets/image-carousel.tsx'
import { Layout } from '../ui/layout.tsx'

export interface BookDetailsPageProps {
  book: Book
  imageUrls: string[]
}

export function BookDetailsPage() {
  return ({ book, imageUrls }: BookDetailsPageProps) => (
    <Layout>
      <div mix={[css({ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' })]}>
        <div
          mix={[
            css({
              height: '400px',
              borderRadius: '8px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }),
          ]}
        >
          <ImageCarousel images={imageUrls} />
        </div>

        <div class="card">
          <h1>{book.title}</h1>
          <p class="author" mix={[css({ fontSize: '1.2rem', margin: '0.5rem 0' })]}>
            by {book.author}
          </p>

          <p mix={[css({ margin: '1rem 0' })]}>
            <span class="badge badge-info">{book.genre}</span>
            <span
              class={`badge ${book.in_stock ? 'badge-success' : 'badge-warning'}`}
              mix={[css({ marginLeft: '0.5rem' })]}
            >
              {book.in_stock ? 'In Stock' : 'Out of Stock'}
            </span>
          </p>

          <p class="price" mix={[css({ fontSize: '2rem', margin: '1rem 0' })]}>
            ${book.price.toFixed(2)}
          </p>

          <p mix={[css({ margin: '1.5rem 0', lineHeight: 1.8 })]}>{book.description}</p>

          <div
            mix={[
              css({
                margin: '1.5rem 0',
                padding: '1rem',
                background: '#f8f9fa',
                borderRadius: '4px',
              }),
            ]}
          >
            <p>
              <strong>ISBN:</strong> {book.isbn}
            </p>
            <p>
              <strong>Published:</strong> {book.published_year}
            </p>
          </div>

          {book.in_stock ? (
            <div mix={[css({ marginTop: '2rem' })]}>
              <Frame src={routes.fragments.cartButton.href({ bookId: book.id })} />
            </div>
          ) : (
            <p mix={[css({ color: '#e74c3c', fontWeight: 500 })]}>
              This book is currently out of stock.
            </p>
          )}

          <p mix={[css({ marginTop: '1.5rem' })]}>
            <a href={routes.books.index.href()} class="btn btn-secondary">
              Back to Books
            </a>
          </p>
        </div>
      </div>
    </Layout>
  )
}

export function BookNotFoundPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>Book Not Found</h1>
      </div>
    </Layout>
  )
}
