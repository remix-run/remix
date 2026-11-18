import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { Book } from '../../data/schema.ts'
import type { Cart } from '../../utils/cart.ts'
import { BookCard } from '../../ui/book-card.tsx'

export function RelatedBooks(handle: Handle<{ books: Book[]; cart: Cart }>) {
  return () => {
    let { books, cart } = handle.props

    return books.length === 0 ? (
      <p>No other books in this genre yet.</p>
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
          />
        ))}
      </div>
    )
  }
}
