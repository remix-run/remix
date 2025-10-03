import type { RequestHandler } from '@remix-run/fetch-router'
import { html } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { layout, escapeHtml } from './views/layout.ts'
import { getUser } from './middleware/auth.ts'
import {
  getAllBooks,
  getBookBySlug,
  getBooksByGenre,
  searchBooks,
  getAvailableGenres,
} from './models/books.ts'

let booksIndexHandler: RequestHandler = (ctx) => {
  let user = getUser(ctx)
  let books = getAllBooks()

  let booksHtml = books
    .map(
      (book) => `
    <div class="book-card">
      <img src="https://via.placeholder.com/280x300?text=${encodeURIComponent(book.title)}" alt="${escapeHtml(book.title)}">
      <div class="book-card-body">
        <h3>${escapeHtml(book.title)}</h3>
        <p class="author">by ${escapeHtml(book.author)}</p>
        <p class="price">$${book.price.toFixed(2)}</p>
        <div style="display: flex; gap: 0.5rem;">
          <a href="${routes.books.show.href({ slug: book.slug })}" class="btn">View Details</a>
        </div>
      </div>
    </div>
  `,
    )
    .join('')

  let genres = getAvailableGenres()
  let genreLinks = genres
    .map(
      (genre) =>
        `<a href="${routes.genres.show.href({ genre })}" class="btn btn-secondary">${escapeHtml(genre)}</a>`,
    )
    .join(' ')

  let content = `
    <h1>Browse Books</h1>
    
    <div class="card" style="margin-bottom: 2rem;">
      <form action="${routes.search.href()}" method="GET" style="display: flex; gap: 0.5rem;">
        <input type="search" name="q" placeholder="Search books by title, author, or description..." style="flex: 1;">
        <button type="submit" class="btn">Search</button>
      </form>
    </div>

    <div class="card" style="margin-bottom: 2rem;">
      <h3>Browse by Genre</h3>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
        ${genreLinks}
      </div>
    </div>
    
    <div class="grid">
      ${booksHtml}
    </div>
  `

  return html(layout(content, user))
}

let bookShowHandler: RequestHandler<{ slug: string }> = (ctx) => {
  let user = getUser(ctx)
  let book = getBookBySlug(ctx.params.slug)

  if (!book) {
    return html(layout('<div class="card"><h1>Book Not Found</h1></div>', user), { status: 404 })
  }

  let content = `
    <div style="display: grid; grid-template-columns: 300px 1fr; gap: 2rem;">
      <div>
        <img src="https://via.placeholder.com/300x400?text=${encodeURIComponent(book.title)}" 
             alt="${escapeHtml(book.title)}" 
             style="width: 100%; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
      </div>
      
      <div class="card">
        <h1>${escapeHtml(book.title)}</h1>
        <p class="author" style="font-size: 1.2rem; margin: 0.5rem 0;">by ${escapeHtml(book.author)}</p>
        
        <p style="margin: 1rem 0;">
          <span class="badge badge-info">${escapeHtml(book.genre)}</span>
          <span class="badge ${book.inStock ? 'badge-success' : 'badge-warning'}" style="margin-left: 0.5rem;">
            ${book.inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </p>

        <p class="price" style="font-size: 2rem; margin: 1rem 0;">$${book.price.toFixed(2)}</p>
        
        <p style="margin: 1.5rem 0; line-height: 1.8;">
          ${escapeHtml(book.description)}
        </p>
        
        <div style="margin: 1.5rem 0; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
          <p><strong>ISBN:</strong> ${escapeHtml(book.isbn)}</p>
          <p><strong>Published:</strong> ${book.publishedYear}</p>
        </div>

        ${
          book.inStock
            ? `
        <form method="POST" action="${routes.cart.api.add.href()}" style="margin-top: 2rem;">
          <input type="hidden" name="bookId" value="${book.id}">
          <input type="hidden" name="slug" value="${book.slug}">
          <button type="submit" class="btn" style="font-size: 1.1rem; padding: 0.75rem 1.5rem;">
            Add to Cart
          </button>
        </form>
        `
            : '<p style="color: #e74c3c; font-weight: 500;">This book is currently out of stock.</p>'
        }

        <p style="margin-top: 1.5rem;">
          <a href="${routes.books.index.href()}" class="btn btn-secondary">Back to Books</a>
        </p>
      </div>
    </div>
  `

  return html(layout(content, user))
}

let genreShowHandler: RequestHandler<{ genre: string }> = (ctx) => {
  let user = getUser(ctx)
  let genre = ctx.params.genre
  let books = getBooksByGenre(genre)

  if (books.length === 0) {
    let content = `
      <div class="card">
        <h1>Genre Not Found</h1>
        <p>No books found in the "${escapeHtml(genre)}" genre.</p>
        <p style="margin-top: 1rem;">
          <a href="${routes.books.index.href()}" class="btn">Browse All Books</a>
        </p>
      </div>
    `

    return html(layout(content, user), { status: 404 })
  }

  let booksHtml = books
    .map(
      (book) => `
    <div class="book-card">
      <img src="https://via.placeholder.com/280x300?text=${encodeURIComponent(book.title)}" alt="${escapeHtml(book.title)}">
      <div class="book-card-body">
        <h3>${escapeHtml(book.title)}</h3>
        <p class="author">by ${escapeHtml(book.author)}</p>
        <p class="price">$${book.price.toFixed(2)}</p>
        <a href="${routes.books.show.href({ slug: book.slug })}" class="btn">View Details</a>
      </div>
    </div>
  `,
    )
    .join('')

  let content = `
    <h1>${escapeHtml(genre.charAt(0).toUpperCase() + genre.slice(1))} Books</h1>
    <p style="margin: 1rem 0;">
      <a href="${routes.books.index.href()}" class="btn btn-secondary">View All Books</a>
    </p>
    
    <div class="grid" style="margin-top: 2rem;">
      ${booksHtml}
    </div>
  `

  return html(layout(content, user))
}

let searchHandler: RequestHandler = (ctx) => {
  let user = getUser(ctx)
  let url = new URL(ctx.request.url)
  let query = url.searchParams.get('q') || ''

  let books = query ? searchBooks(query) : []

  let booksHtml =
    books.length > 0
      ? books
          .map(
            (book) => `
      <div class="book-card">
        <img src="https://via.placeholder.com/280x300?text=${encodeURIComponent(book.title)}" alt="${escapeHtml(book.title)}">
        <div class="book-card-body">
          <h3>${escapeHtml(book.title)}</h3>
          <p class="author">by ${escapeHtml(book.author)}</p>
          <p class="price">$${book.price.toFixed(2)}</p>
          <a href="${routes.books.show.href({ slug: book.slug })}" class="btn">View Details</a>
        </div>
      </div>
    `,
          )
          .join('')
      : '<p>No books found matching your search.</p>'

  let content = `
    <h1>Search Results</h1>
    
    <div class="card" style="margin-bottom: 2rem;">
      <form action="${routes.search.href()}" method="GET" style="display: flex; gap: 0.5rem;">
        <input type="search" name="q" placeholder="Search books..." value="${escapeHtml(query)}" style="flex: 1;">
        <button type="submit" class="btn">Search</button>
      </form>
    </div>

    ${query ? `<p style="margin-bottom: 1rem;">Found ${books.length} result(s) for "${escapeHtml(query)}"</p>` : ''}
    
    <div class="grid">
      ${booksHtml}
    </div>
  `

  return html(layout(content, user))
}

export default {
  books: {
    index: booksIndexHandler,
    show: bookShowHandler,
  },
  genres: {
    show: genreShowHandler,
  },
  search: searchHandler,
}
