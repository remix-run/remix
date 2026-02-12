import { routes } from '../routes.ts'
import type { Book } from '../models/books.ts'
import { Frame } from 'remix/component'

export interface BookCardProps {
  book: Book
  inCart: boolean
}

export function BookCard() {
  return ({ book }: BookCardProps) => (
    <div class="book-card">
      <img src={book.coverUrl} alt={book.title} />
      <div class="book-card-body">
        <h3>{book.title}</h3>
        <p class="author">by {book.author}</p>
        <p class="price">${book.price.toFixed(2)}</p>
        <div css={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <a href={routes.books.show.href({ slug: book.slug })} class="btn">
            View Details
          </a>

          <Frame src={routes.fragments.cartButton.href({ bookId: book.id })} />
        </div>
      </div>
    </div>
  )
}
