// Admin book management handlers

import type { RequestHandler } from '@remix-run/fetch-router'
import { html } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { layout, escapeHtml, redirect } from './views/layout.ts'
import { getUser } from './middleware/auth.ts'
import { getAllBooks, getBookById, createBook, updateBook, deleteBook } from './models/books.ts'

let indexHandler: RequestHandler = (ctx) => {
  // User is guaranteed to exist and be admin because middleware ran
  let user = getUser(ctx)!
  let books = getAllBooks()

  let booksHtml = `
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Author</th>
          <th>Genre</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${books
          .map(
            (book) => `
          <tr>
            <td>${escapeHtml(book.title)}</td>
            <td>${escapeHtml(book.author)}</td>
            <td>${escapeHtml(book.genre)}</td>
            <td>$${book.price.toFixed(2)}</td>
            <td><span class="badge ${book.inStock ? 'badge-success' : 'badge-warning'}">${book.inStock ? 'Yes' : 'No'}</span></td>
            <td class="actions">
              <a href="${routes.admin.books.edit.href({ bookId: book.id })}" class="btn btn-secondary" style="font-size: 0.875rem; padding: 0.25rem 0.5rem;">Edit</a>
              <form method="POST" action="${routes.admin.books.destroy.href({ bookId: book.id })}" style="display: inline;">
                <button type="submit" class="btn btn-danger" style="font-size: 0.875rem; padding: 0.25rem 0.5rem;" onclick="return confirm('Are you sure?')">Delete</button>
              </form>
            </td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `

  let content = `
    <h1>Manage Books</h1>
    
    <p style="margin-bottom: 1rem;">
      <a href="${routes.admin.books.new.href()}" class="btn">Add New Book</a>
      <a href="${routes.admin.index.href()}" class="btn btn-secondary" style="margin-left: 0.5rem;">Back to Dashboard</a>
    </p>

    <div class="card">
      ${booksHtml}
    </div>
  `

  return html(layout(content, user))
}

let showHandler: RequestHandler<{ bookId: string }> = (ctx) => {
  // User is guaranteed to exist and be admin because middleware ran
  let user = getUser(ctx)!
  let book = getBookById(ctx.params.bookId)

  if (!book) {
    return html(layout('<div class="card"><h1>Book Not Found</h1></div>', user), { status: 404 })
  }

  let content = `
    <h1>Book Details</h1>
    
    <div class="card">
      <p><strong>Title:</strong> ${escapeHtml(book.title)}</p>
      <p><strong>Author:</strong> ${escapeHtml(book.author)}</p>
      <p><strong>Slug:</strong> ${escapeHtml(book.slug)}</p>
      <p><strong>Description:</strong> ${escapeHtml(book.description)}</p>
      <p><strong>Price:</strong> $${book.price.toFixed(2)}</p>
      <p><strong>Genre:</strong> ${escapeHtml(book.genre)}</p>
      <p><strong>ISBN:</strong> ${escapeHtml(book.isbn)}</p>
      <p><strong>Published:</strong> ${book.publishedYear}</p>
      <p><strong>In Stock:</strong> <span class="badge ${book.inStock ? 'badge-success' : 'badge-warning'}">${book.inStock ? 'Yes' : 'No'}</span></p>
      
      <div style="margin-top: 2rem;">
        <a href="${routes.admin.books.edit.href({ bookId: book.id })}" class="btn">Edit</a>
        <a href="${routes.admin.books.index.href()}" class="btn btn-secondary" style="margin-left: 0.5rem;">Back to List</a>
      </div>
    </div>
  `

  return html(layout(content, user))
}

let newHandler: RequestHandler = (ctx) => {
  // User is guaranteed to exist and be admin because middleware ran
  let user = getUser(ctx)!

  let content = `
    <h1>Add New Book</h1>
    
    <div class="card">
      <form method="POST" action="${routes.admin.books.create.href()}">
        <div class="form-group">
          <label for="title">Title</label>
          <input type="text" id="title" name="title" required>
        </div>
        
        <div class="form-group">
          <label for="author">Author</label>
          <input type="text" id="author" name="author" required>
        </div>
        
        <div class="form-group">
          <label for="slug">Slug (URL-friendly name)</label>
          <input type="text" id="slug" name="slug" required>
        </div>
        
        <div class="form-group">
          <label for="description">Description</label>
          <textarea id="description" name="description" required></textarea>
        </div>
        
        <div class="form-group">
          <label for="price">Price</label>
          <input type="number" id="price" name="price" step="0.01" required>
        </div>
        
        <div class="form-group">
          <label for="genre">Genre</label>
          <input type="text" id="genre" name="genre" required>
        </div>
        
        <div class="form-group">
          <label for="isbn">ISBN</label>
          <input type="text" id="isbn" name="isbn" required>
        </div>
        
        <div class="form-group">
          <label for="publishedYear">Published Year</label>
          <input type="number" id="publishedYear" name="publishedYear" required>
        </div>
        
        <div class="form-group">
          <label for="inStock">In Stock</label>
          <select id="inStock" name="inStock">
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        
        <button type="submit" class="btn">Create Book</button>
        <a href="${routes.admin.books.index.href()}" class="btn btn-secondary" style="margin-left: 0.5rem;">Cancel</a>
      </form>
    </div>
  `

  return html(layout(content, user))
}

let createHandler: RequestHandler = async (ctx) => {
  // User is guaranteed to exist and be admin because middleware ran

  let formData = await ctx.request.formData()

  createBook({
    slug: formData.get('slug')?.toString() || '',
    title: formData.get('title')?.toString() || '',
    author: formData.get('author')?.toString() || '',
    description: formData.get('description')?.toString() || '',
    price: parseFloat(formData.get('price')?.toString() || '0'),
    genre: formData.get('genre')?.toString() || '',
    coverUrl: '/images/placeholder.jpg',
    isbn: formData.get('isbn')?.toString() || '',
    publishedYear: parseInt(formData.get('publishedYear')?.toString() || '2024', 10),
    inStock: formData.get('inStock')?.toString() === 'true',
  })

  return redirect(routes.admin.books.index.href(), ctx.url)
}

let editHandler: RequestHandler<{ bookId: string }> = (ctx) => {
  // User is guaranteed to exist and be admin because middleware ran
  let user = getUser(ctx)!
  let book = getBookById(ctx.params.bookId)

  if (!book) {
    return html(layout('<div class="card"><h1>Book Not Found</h1></div>', user), { status: 404 })
  }

  let content = `
    <h1>Edit Book</h1>
    
    <div class="card">
      <form method="POST" action="${routes.admin.books.update.href({ bookId: book.id })}">
        <div class="form-group">
          <label for="title">Title</label>
          <input type="text" id="title" name="title" value="${escapeHtml(book.title)}" required>
        </div>
        
        <div class="form-group">
          <label for="author">Author</label>
          <input type="text" id="author" name="author" value="${escapeHtml(book.author)}" required>
        </div>
        
        <div class="form-group">
          <label for="slug">Slug (URL-friendly name)</label>
          <input type="text" id="slug" name="slug" value="${escapeHtml(book.slug)}" required>
        </div>
        
        <div class="form-group">
          <label for="description">Description</label>
          <textarea id="description" name="description" required>${escapeHtml(book.description)}</textarea>
        </div>
        
        <div class="form-group">
          <label for="price">Price</label>
          <input type="number" id="price" name="price" step="0.01" value="${book.price}" required>
        </div>
        
        <div class="form-group">
          <label for="genre">Genre</label>
          <input type="text" id="genre" name="genre" value="${escapeHtml(book.genre)}" required>
        </div>
        
        <div class="form-group">
          <label for="isbn">ISBN</label>
          <input type="text" id="isbn" name="isbn" value="${escapeHtml(book.isbn)}" required>
        </div>
        
        <div class="form-group">
          <label for="publishedYear">Published Year</label>
          <input type="number" id="publishedYear" name="publishedYear" value="${book.publishedYear}" required>
        </div>
        
        <div class="form-group">
          <label for="inStock">In Stock</label>
          <select id="inStock" name="inStock">
            <option value="true" ${book.inStock ? 'selected' : ''}>Yes</option>
            <option value="false" ${!book.inStock ? 'selected' : ''}>No</option>
          </select>
        </div>
        
        <button type="submit" class="btn">Update Book</button>
        <a href="${routes.admin.books.index.href()}" class="btn btn-secondary" style="margin-left: 0.5rem;">Cancel</a>
      </form>
    </div>
  `

  return html(layout(content, user))
}

let updateHandler: RequestHandler<{ bookId: string }> = async (ctx) => {
  // User is guaranteed to exist and be admin because middleware ran

  let formData = await ctx.request.formData()

  updateBook(ctx.params.bookId, {
    slug: formData.get('slug')?.toString() || '',
    title: formData.get('title')?.toString() || '',
    author: formData.get('author')?.toString() || '',
    description: formData.get('description')?.toString() || '',
    price: parseFloat(formData.get('price')?.toString() || '0'),
    genre: formData.get('genre')?.toString() || '',
    isbn: formData.get('isbn')?.toString() || '',
    publishedYear: parseInt(formData.get('publishedYear')?.toString() || '2024', 10),
    inStock: formData.get('inStock')?.toString() === 'true',
  })

  return redirect(routes.admin.books.index.href(), ctx.url)
}

let destroyHandler: RequestHandler<{ bookId: string }> = (ctx) => {
  // User is guaranteed to exist and be admin because middleware ran

  deleteBook(ctx.params.bookId)

  return redirect(routes.admin.books.index.href(), ctx.url)
}

export default {
  index: indexHandler,
  show: showHandler,
  new: newHandler,
  create: createHandler,
  edit: editHandler,
  update: updateHandler,
  destroy: destroyHandler,
}
