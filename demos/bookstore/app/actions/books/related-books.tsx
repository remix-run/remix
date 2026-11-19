import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { Book } from '../../data/schema.ts'
import type { Cart } from '../../utils/cart.ts'
import { BookCard } from '../../ui/book-card.tsx'

export function RelatedBooks(handle: Handle<{ books: Book[]; cart: Cart }>) {
  return () => {
    let { books, cart } = handle.props

    return books.length === 0 ? (
      <p>No other books in this category yet.</p>
    ) : (
      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
          gap: '1.5rem',
        })}
      >
        {books.map((book) => (
          <BookCard
            book={book}
            inCart={cart.items.some((item) => item.bookId === book.id)}
            imageLoading="lazy"
            // This grid sits inside the details column with its own 240px minimum.
            imageSizes="(min-width: 1200px) 378px, (min-width: 924px) calc((100vw - 444px) / 2), (min-width: 769px) calc(100vw - 420px), (min-width: 592px) calc((100vw - 112px) / 2), calc(100vw - 88px)"
          />
        ))}
      </div>
    )
  }
}
