import type { Handle } from 'remix/component'
import { Frame, css } from 'remix/component'

import type { Book } from '../data/schema.ts'
import { routes } from '../routes.ts'
import { bookCoverTransition, bookTitleTransition } from './book-transitions.ts'

export interface BookCardProps {
  book: Book
  inCart: boolean
}

export function BookCard(handle: Handle<BookCardProps>) {
  return () => {
    let { book } = handle.props

    return (
      <div
        data-test-slug={book.slug}
        mix={css({
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
          },
        })}
      >
        <a href={routes.books.show.href({ slug: book.slug })} data-rmx-prefetch="viewport">
          <img
            src={book.cover_url}
            alt={book.title}
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
          <h3
            mix={[
              bookTitleTransition(book.id),
              css({ fontSize: '1.1rem', marginBottom: '0.5rem' }),
            ]}
          >
            {book.title}
          </h3>
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
                padding: '0.5rem 0.125rem',
                fontSize: '0.75rem',
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
