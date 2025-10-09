import { routes } from '../../routes.ts'

import type { Book } from '../models/books.ts'

export interface BookCardProps {
  book: Book
}

export function BookCard({ book }: BookCardProps) {
  return (
    <div class="book-card">
      <img
        src={`https://via.placeholder.com/280x300?text=${encodeURIComponent(book.title)}`}
        alt={book.title}
      />
      <div class="book-card-body">
        <h3>{book.title}</h3>
        <p class="author">by {book.author}</p>
        <p class="price">${book.price.toFixed(2)}</p>
        <a href={routes.books.show.href({ slug: book.slug })} class="btn">
          View Details
        </a>
      </div>
    </div>
  )
}
