import type { Handle } from 'remix/component'
import { Frame, css } from 'remix/component'

import type { Book } from '../../data/schema.ts'
import { getBookGenreLabel } from '../../data/book-genres.ts'
import { routes } from '../../routes.ts'
import { ImageCarousel } from './public/image-carousel.tsx'
import { bookCoverTransition } from '../../ui/book-transitions.ts'
import { Layout } from '../../ui/layout.tsx'

export interface ShowPageProps {
  book: Book
  imageUrls: string[]
  startIndex: number
}

export function ShowPage(handle: Handle<ShowPageProps>) {
  return () => {
    let { book, imageUrls, startIndex } = handle.props
    let mainImage = imageUrls[startIndex]

    return (
      <Layout head={mainImage ? <link rel="preload" as="image" href={mainImage} /> : null}>
        <div
          mix={css({
            display: 'grid',
            gridTemplateColumns: '300px minmax(0, 1fr)',
            gap: '2rem',
            '@media (max-width: 768px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
          })}
        >
          <div
            class="card"
            mix={css({
              gridColumn: 2,
              position: 'relative',
              minHeight: '400px',
              '@media (max-width: 768px)': { gridColumn: 1 },
            })}
          >
            <h1>{book.title}</h1>
            <p class="author" mix={css({ fontSize: '1.2rem', margin: '0.5rem 0' })}>
              by {book.author}
            </p>

            <p mix={css({ margin: '1rem 0' })}>
              <span class="badge badge-info">{getBookGenreLabel(book.genre)}</span>
              <span
                class={`badge ${book.in_stock ? 'badge-success' : 'badge-warning'}`}
                mix={css({ marginLeft: '0.5rem' })}
              >
                {book.in_stock ? 'In Stock' : 'Out of Stock'}
              </span>
            </p>

            <div
              mix={[
                bookCoverTransition(book.id),
                css({
                  // Keep one carousel mounted as it moves into the card on small screens.
                  position: 'absolute',
                  top: 0,
                  left: 'calc(-300px - 2rem)',
                  width: '300px',
                  height: '400px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  '@media (max-width: 768px)': {
                    position: 'relative',
                    left: 'auto',
                    width: '100%',
                    maxWidth: '300px',
                    height: 'auto',
                    aspectRatio: '3 / 4',
                    margin: '1rem 0',
                  },
                }),
              ]}
            >
              <ImageCarousel images={imageUrls} startIndex={startIndex} />
            </div>

            <p class="price" mix={css({ fontSize: '2rem', margin: '1rem 0' })}>
              ${book.price.toFixed(2)}
            </p>

            <p mix={css({ margin: '1.5rem 0', lineHeight: 1.8 })}>{book.description}</p>

            <div
              mix={css({
                margin: '1.5rem 0',
                padding: '1rem',
                background: '#f8f9fa',
                borderRadius: '4px',
              })}
            >
              <p>
                <strong>ISBN:</strong> {book.isbn}
              </p>
              <p>
                <strong>Published:</strong> {book.published_year}
              </p>
            </div>

            {book.in_stock ? (
              <div mix={css({ marginTop: '2rem' })}>
                <Frame
                  name={`cart-button-${book.id}`}
                  src={routes.fragments.cartButton.href({ bookId: book.id })}
                />
              </div>
            ) : (
              <p mix={css({ color: '#e74c3c', fontWeight: 500 })}>
                This book is currently out of stock.
              </p>
            )}

            <p mix={css({ marginTop: '1.5rem' })}>
              <a
                data-rmx-prefetch="intent"
                href={routes.books.index.href()}
                class="btn btn-secondary"
              >
                Back to Books
              </a>
            </p>
          </div>
          <section
            class="card"
            aria-labelledby="related-books-heading"
            mix={css({
              gridColumn: 2,
              minWidth: 0,
              '@media (max-width: 768px)': { gridColumn: 1 },
            })}
          >
            <h2 id="related-books-heading" mix={css({ marginBottom: '1.5rem' })}>
              Related Books
            </h2>
            <Frame
              name={`related-books-${book.id}`}
              src={routes.books.related.href({ slug: book.slug })}
              loading="lazy"
              fallback={
                <div
                  mix={css({
                    minHeight: '450px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  })}
                >
                  <p role="status">Loading related books…</p>
                  <a href={routes.books.genre.href({ genre: book.genre })}>Browse this category</a>
                </div>
              }
            />
          </section>
        </div>
      </Layout>
    )
  }
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
