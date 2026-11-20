import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { BookWithCover } from '../utils/book-images.ts'
import { routes } from '../routes.ts'
import { BookCard, BookCoverPreload } from '../ui/book-card.tsx'
import { Layout } from '../ui/layout.tsx'

interface HomePageProps {
  featuredBooks: BookWithCover[]
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { featuredBooks } = handle.props

    return (
      <Layout head={<BookCoverPreload book={featuredBooks[0]} />}>
        <div class="card">
          <h1>Welcome to the Bookstore</h1>
          <p mix={css({ margin: '1rem 0' })}>
            Discover your next favorite book from our curated collection of fiction, non-fiction,
            and more.
          </p>
          <p>
            <a data-rmx-prefetch="intent" href={routes.books.index.href()} class="btn">
              Browse Books
            </a>
          </p>
        </div>

        <h2 mix={css({ margin: '2rem 0 1rem' })}>Featured Books</h2>
        <div class="grid">
          {featuredBooks.map((book) => (
            <BookCard book={book} />
          ))}
        </div>
      </Layout>
    )
  }
}
