import { routes } from '../../routes.ts'

import { ImageCarousel } from '../assets/image-carousel.tsx'
import { CartButton } from '../assets/cart-button.tsx'
import type { Book } from '../models/books.ts'

export interface BookCardProps {
  book: Book
  inCart: boolean
}

export function BookCard({ book, inCart }: BookCardProps) {
  return (
    <div class="book-card">
      <img src={book.coverUrl} alt={book.title} />
      <div class="book-card-body">
        <h3>{book.title}</h3>
        <p class="author">by {book.author}</p>
        <p class="price">${book.price.toFixed(2)}</p>
        <a href={routes.books.show.href({ slug: book.slug })} class="btn">
          View Details
        </a>

        <CartButton inCart={inCart} id={book.id} slug={book.slug} />
      </div>
    </div>
  )
}
