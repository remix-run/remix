import { createHandlers } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { html } from './utils/response.ts'

export const booksHandlers = createHandlers(routes.books, {
  catalog({ url }) {
    let search = url.searchParams.get('q') || ''
    let category = url.searchParams.get('category') || 'all'
    return html(renderBookCatalog(search, category))
  },
  details({ params }) {
    return html(renderBookDetails(params.isbn))
  },
  reviews: {
    get({ params }) {
      return html(renderBookReviews(params.isbn))
    },
    async post({ params, request }) {
      let review = await request.json()
      return new Response(`Review added for book ${params.isbn}: ${review.rating}/5 stars`)
    },
  },
  category({ params }) {
    return html(renderCategory(params.category))
  },
  author({ params }) {
    return html(renderAuthor(params.author))
  },
})

function renderBookCatalog(search: string, category: string) {
  return `
    <html>
      <head><title>Books - Bookstore</title></head>
      <body>
        <h1>📚 Book Catalog</h1>
        <form>
          <input name="q" placeholder="Search books..." value="${search}">
          <select name="category">
            <option value="all" ${category === 'all' ? 'selected' : ''}>All Categories</option>
            <option value="fiction" ${category === 'fiction' ? 'selected' : ''}>Fiction</option>
            <option value="non-fiction" ${category === 'non-fiction' ? 'selected' : ''}>Non-Fiction</option>
          </select>
          <button type="submit">Search</button>
        </form>
        <div>
          <div>📖 <a href="${routes.books.details.href({ isbn: '978-0-123456-78-9' })}">The Great Novel</a> - $19.99</div>
          <div>📚 <a href="${routes.books.details.href({ isbn: '978-0-987654-32-1' })}">Programming Guide</a> - $29.99</div>
          <div>📘 <a href="${routes.books.details.href({ isbn: '978-0-555666-77-8' })}">History Book</a> - $24.99</div>
        </div>
      </body>
    </html>
  `
}

function renderBookDetails(isbn: string) {
  return `
    <html>
      <head><title>Book ${isbn} - Bookstore</title></head>
      <body>
        <h1>📖 Book Details</h1>
        <h2>ISBN: ${isbn}</h2>
        <p><strong>Title:</strong> Sample Book Title</p>
        <p><strong>Author:</strong> <a href="${routes.api.books.author.show.href({ id: isbn })}">View Author Details</a></p>
        <p><strong>Category:</strong> <a href="${routes.books.category.href({ category: 'fiction' })}">Fiction</a></p>
        <p><strong>Price:</strong> $19.99</p>
        <p><strong>Description:</strong> A fascinating tale that will keep you reading.</p>
        <button>Add to Cart</button>
        <p><a href="${routes.books.reviews.href({ isbn })}">Read Reviews</a></p>
        <p><a href="${routes.api.books.author.edit.href({ id: isbn })}">Edit Author Info</a> (Admin)</p>
      </body>
    </html>
  `
}

function renderBookReviews(isbn: string) {
  return `
    <html>
      <head><title>Reviews for ${isbn}</title></head>
      <body>
        <h1>📝 Book Reviews</h1>
        <h2>ISBN: ${isbn}</h2>
        <div>
          <h3>⭐⭐⭐⭐⭐ "Amazing book!"</h3>
          <p>Really enjoyed this story. Highly recommended!</p>
        </div>
        <div>
          <h3>⭐⭐⭐⭐ "Good read"</h3>
          <p>Well written and engaging throughout.</p>
        </div>
        <form>
          <h3>Add Your Review</h3>
          <p><label>Rating: <select name="rating">
            <option value="5">⭐⭐⭐⭐⭐</option>
            <option value="4">⭐⭐⭐⭐</option>
            <option value="3">⭐⭐⭐</option>
          </select></label></p>
          <p><label>Review: <textarea name="review" required></textarea></label></p>
          <button type="submit">Submit Review</button>
        </form>
      </body>
    </html>
  `
}

function renderCategory(category: string) {
  return `
    <html>
      <head><title>${category} Books - Bookstore</title></head>
      <body>
        <h1>📚 ${category.charAt(0).toUpperCase() + category.slice(1)} Books</h1>
        <div>Books in the ${category} category...</div>
      </body>
    </html>
  `
}

function renderAuthor(author: string) {
  return `
    <html>
      <head><title>Books by ${author} - Bookstore</title></head>
      <body>
        <h1>✍️ Books by ${author.replace('-', ' ')}</h1>
        <div>Books by this author...</div>
      </body>
    </html>
  `
}
