import type { Controller } from 'remix/fetch-router'
import { css } from 'remix/component'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import * as coerce from 'remix/data-schema/coerce'
import { redirect } from 'remix/response/redirect'

import { routes } from './routes.ts'
import { books } from './data/schema.ts'
import { Layout } from './layout.tsx'
import { parseId } from './utils/ids.ts'
import { render } from './utils/render.ts'
import { RestfulForm } from './components/restful-form.tsx'

const textField = f.field(s.defaulted(s.optional(s.string()), ''))
const optionalTextField = f.field(s.optional(s.string()))
const priceField = f.field(s.defaulted(s.optional(s.string()), '0'))
const publishedYearField = f.field(s.defaulted(s.optional(s.string()), '2024'), {
  name: 'publishedYear',
})
const inStockField = f.field(s.defaulted(s.optional(coerce.boolean()), false), {
  name: 'inStock',
})
const bookSchema = f.object({
  slug: textField,
  title: textField,
  author: textField,
  description: textField,
  price: priceField,
  genre: textField,
  cover: optionalTextField,
  isbn: textField,
  publishedYear: publishedYearField,
  inStock: inStockField,
})

export default {
  actions: {
    async index({ db }) {
      let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] })

      return render(
        <Layout>
          <h1>Manage Books</h1>

          <p mix={[css({ marginBottom: '1rem' })]}>
            <a href={routes.admin.books.new.href()} class="btn">
              Add New Book
            </a>
            <a
              href={routes.admin.index.href()}
              class="btn btn-secondary"
              mix={[css({ marginLeft: '0.5rem' })]}
            >
              Back to Dashboard
            </a>
          </p>

          <div class="card">
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
                {allBooks.map((book) => (
                  <tr>
                    <td>{book.title}</td>
                    <td>{book.author}</td>
                    <td>{book.genre}</td>
                    <td>${book.price.toFixed(2)}</td>
                    <td>
                      <span class={`badge ${book.in_stock ? 'badge-success' : 'badge-warning'}`}>
                        {book.in_stock ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td class="actions">
                      <a
                        href={routes.admin.books.edit.href({ bookId: book.id })}
                        class="btn btn-secondary"
                        mix={[css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })]}
                      >
                        Edit
                      </a>
                      <RestfulForm
                        method="DELETE"
                        action={routes.admin.books.destroy.href({ bookId: book.id })}
                        mix={[css({ display: 'inline' })]}
                      >
                        <button
                          type="submit"
                          class="btn btn-danger"
                          mix={[css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })]}
                        >
                          Delete
                        </button>
                      </RestfulForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Layout>,
      )
    },

    async show({ db, params }) {
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)

      if (!book) {
        return render(
          <Layout>
            <div class="card">
              <h1>Book Not Found</h1>
            </div>
          </Layout>,
          { status: 404 },
        )
      }

      return render(
        <Layout>
          <h1>Book Details</h1>

          <div class="card">
            <p>
              <strong>Title:</strong> {book.title}
            </p>
            <p>
              <strong>Author:</strong> {book.author}
            </p>
            <p>
              <strong>Slug:</strong> {book.slug}
            </p>
            <p>
              <strong>Description:</strong> {book.description}
            </p>
            <p>
              <strong>Price:</strong> ${book.price.toFixed(2)}
            </p>
            <p>
              <strong>Genre:</strong> {book.genre}
            </p>
            <p>
              <strong>ISBN:</strong> {book.isbn}
            </p>
            <p>
              <strong>Published:</strong> {book.published_year}
            </p>
            <p>
              <strong>In Stock:</strong>{' '}
              <span class={`badge ${book.in_stock ? 'badge-success' : 'badge-warning'}`}>
                {book.in_stock ? 'Yes' : 'No'}
              </span>
            </p>

            <div mix={[css({ marginTop: '2rem' })]}>
              <a href={routes.admin.books.edit.href({ bookId: book.id })} class="btn">
                Edit
              </a>
              <a
                href={routes.admin.books.index.href()}
                class="btn btn-secondary"
                mix={[css({ marginLeft: '0.5rem' })]}
              >
                Back to List
              </a>
            </div>
          </div>
        </Layout>,
      )
    },

    new() {
      return render(
        <Layout>
          <h1>Add New Book</h1>

          <div class="card">
            <form
              method="POST"
              action={routes.admin.books.create.href()}
              encType="multipart/form-data"
            >
              <div class="form-group">
                <label for="title">Title</label>
                <input type="text" id="title" name="title" required />
              </div>

              <div class="form-group">
                <label for="author">Author</label>
                <input type="text" id="author" name="author" required />
              </div>

              <div class="form-group">
                <label for="slug">Slug (URL-friendly name)</label>
                <input type="text" id="slug" name="slug" required />
              </div>

              <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" required></textarea>
              </div>

              <div class="form-group">
                <label for="price">Price</label>
                <input type="number" id="price" name="price" step="0.01" required />
              </div>

              <div class="form-group">
                <label for="genre">Genre</label>
                <input type="text" id="genre" name="genre" required />
              </div>

              <div class="form-group">
                <label for="isbn">ISBN</label>
                <input type="text" id="isbn" name="isbn" required />
              </div>

              <div class="form-group">
                <label for="publishedYear">Published Year</label>
                <input type="number" id="publishedYear" name="publishedYear" required />
              </div>

              <div class="form-group">
                <label for="inStock">In Stock</label>
                <select id="inStock" name="inStock">
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div class="form-group">
                <label for="cover">Book Cover Image</label>
                <input type="file" id="cover" name="cover" accept="image/*" />
                <small mix={[css({ color: '#666' })]}>
                  Optional. Upload a cover image for this book.
                </small>
              </div>

              <button type="submit" class="btn">
                Create Book
              </button>
              <a
                href={routes.admin.books.index.href()}
                class="btn btn-secondary"
                mix={[css({ marginLeft: '0.5rem' })]}
              >
                Cancel
              </a>
            </form>
          </div>
        </Layout>,
      )
    },

    async create({ db, get }) {
      let formData = get(FormData)
      let { author, cover, description, genre, inStock, isbn, price, publishedYear, slug, title } =
        s.parse(bookSchema, formData)

      await db.create(books, {
        slug,
        title,
        author,
        description,
        price: parseFloat(price),
        genre,
        cover_url: cover ?? '/images/placeholder.jpg',
        image_urls: JSON.stringify([]),
        isbn,
        published_year: parseInt(publishedYear, 10),
        in_stock: inStock,
      })

      return redirect(routes.admin.books.index.href())
    },

    async edit({ db, params }) {
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)

      if (!book) {
        return render(
          <Layout>
            <div class="card">
              <h1>Book Not Found</h1>
            </div>
          </Layout>,
          { status: 404 },
        )
      }

      return render(
        <Layout>
          <h1>Edit Book</h1>

          <div class="card">
            <RestfulForm
              method="PUT"
              action={routes.admin.books.update.href({ bookId: book.id })}
              encType="multipart/form-data"
            >
              <div class="form-group">
                <label for="title">Title</label>
                <input type="text" id="title" name="title" value={book.title} required />
              </div>

              <div class="form-group">
                <label for="author">Author</label>
                <input type="text" id="author" name="author" value={book.author} required />
              </div>

              <div class="form-group">
                <label for="slug">Slug (URL-friendly name)</label>
                <input type="text" id="slug" name="slug" value={book.slug} required />
              </div>

              <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" required>
                  {book.description}
                </textarea>
              </div>

              <div class="form-group">
                <label for="price">Price</label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  step="0.01"
                  value={book.price}
                  required
                />
              </div>

              <div class="form-group">
                <label for="genre">Genre</label>
                <input type="text" id="genre" name="genre" value={book.genre} required />
              </div>

              <div class="form-group">
                <label for="isbn">ISBN</label>
                <input type="text" id="isbn" name="isbn" value={book.isbn} required />
              </div>

              <div class="form-group">
                <label for="publishedYear">Published Year</label>
                <input
                  type="number"
                  id="publishedYear"
                  name="publishedYear"
                  value={book.published_year}
                  required
                />
              </div>

              <div class="form-group">
                <label for="inStock">In Stock</label>
                <select id="inStock" name="inStock">
                  <option value="true" selected={book.in_stock}>
                    Yes
                  </option>
                  <option value="false" selected={!book.in_stock}>
                    No
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label for="cover">Book Cover Image</label>
                {book.cover_url !== '/images/placeholder.jpg' && (
                  <div mix={[css({ marginBottom: '0.5rem' })]}>
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      mix={[css({ maxWidth: '200px', height: 'auto', borderRadius: '4px' })]}
                    />
                    <p mix={[css({ fontSize: '0.875rem', color: '#666' })]}>Current cover image</p>
                  </div>
                )}
                <input type="file" id="cover" name="cover" accept="image/*" />
                <small mix={[css({ color: '#666' })]}>
                  Optional. Upload a new cover image to replace the current one.
                </small>
              </div>

              <button type="submit" class="btn">
                Update Book
              </button>
              <a
                href={routes.admin.books.index.href()}
                class="btn btn-secondary"
                mix={[css({ marginLeft: '0.5rem' })]}
              >
                Cancel
              </a>
            </RestfulForm>
          </div>
        </Layout>,
      )
    },

    async update({ db, get, params }) {
      let formData = get(FormData)
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)
      if (!book) {
        return new Response('Book not found', { status: 404 })
      }

      let { author, cover, description, genre, inStock, isbn, price, publishedYear, slug, title } =
        s.parse(bookSchema, formData)

      // The uploadHandler automatically saves the file and returns the URL path
      // If no file was uploaded, keep the existing cover_url
      let cover_url = cover || book.cover_url

      await db.update(books, book.id, {
        slug,
        title,
        author,
        description,
        price: parseFloat(price),
        genre,
        cover_url,
        isbn,
        published_year: parseInt(publishedYear, 10),
        in_stock: inStock,
      })

      return redirect(routes.admin.books.index.href())
    },

    async destroy({ db, params }) {
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)
      if (book) {
        await db.delete(books, book.id)
      }

      return redirect(routes.admin.books.index.href())
    },
  },
} satisfies Controller<typeof routes.admin.books>
