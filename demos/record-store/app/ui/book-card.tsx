import type { Handle } from 'remix/component'
import { Frame, attrs, css } from 'remix/component'

import type { BookWithCover } from '../utils/book-images.ts'
import { routes } from '../routes.ts'
import { bookCoverTransition } from './book-transitions.ts'

// Match the shared grid's 250px minimum, 24px gaps, and 1200px container.
export const bookCardImageSizes =
  '(min-width: 1200px) 272px, (min-width: 1112px) calc((100vw - 112px) / 4), (min-width: 838px) calc((100vw - 88px) / 3), (min-width: 564px) calc((100vw - 64px) / 2), calc(100vw - 40px)'

export function BookCoverPreload(handle: Handle<{ book: BookWithCover | undefined }>) {
  return () => {
    let { book } = handle.props
    return book ? (
      <link
        rel="preload"
        as="image"
        href={book.cover_url}
        imageSrcSet={book.cover_srcset}
        mix={attrs({ imagesizes: book.cover_srcset ? bookCardImageSizes : undefined })}
      />
    ) : null
  }
}

export interface BookCardProps {
  book: BookWithCover
  imageLoading?: 'eager' | 'lazy'
  imageSizes?: string
}

export function BookCard(handle: Handle<BookCardProps>) {
  return () => {
    let { book, imageLoading = 'eager', imageSizes = bookCardImageSizes } = handle.props

    return (
      <div
        data-test-slug={book.slug}
        data-book-id={book.id}
        mix={css({
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          transition: 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
          },
        })}
      >
        <a href={routes.books.show.href({ slug: book.slug })} data-rmx-prefetch="viewport">
          <img
            src={book.cover_url}
            srcset={book.cover_srcset}
            sizes={book.cover_srcset ? imageSizes : undefined}
            alt={book.title}
            loading={imageLoading}
            mix={[
              bookCoverTransition(book.id),
              css({
                display: 'block',
                width: '100%',
                height: '300px',
                objectFit: 'cover',
                background: '#ecf0f1',
              }),
            ]}
          />
        </a>
        <div mix={css({ display: 'flex', flex: 1, flexDirection: 'column', padding: '1rem' })}>
          <h3 mix={css({ fontSize: '1.1rem', marginBottom: '0.5rem' })}>{book.title}</h3>
          <p mix={css({ color: '#7f8c8d', fontSize: '0.9rem', marginBottom: '0.5rem' })}>
            by {book.author}
          </p>
          <p
            mix={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#27ae60',
              margin: 'auto 0 0.5rem',
              paddingTop: '0.5rem',
            })}
          >
            ${book.price.toFixed(2)}
          </p>
          <div
            mix={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.25rem',
              alignItems: 'center',
              '& .btn': {
                flex: 1,
                minWidth: 0,
                padding: '0.5rem 0.0625rem',
                fontSize: '0.6875rem',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              },
              '& [role="alert"]': { flexBasis: '100%' },
            })}
          >
            <a href={routes.books.show.href({ slug: book.slug })} class="btn">
              View Details
            </a>

            <Frame
              name={`cart-button-${book.id}`}
              src={routes.fragments.cartButton.href({ bookId: book.id })}
            />
          </div>
        </div>
      </div>
    )
  }
}
