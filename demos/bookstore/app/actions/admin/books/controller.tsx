import type { AppController } from '../../../router.ts'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import * as coerce from 'remix/data-schema/coerce'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { books } from '../../../data/schema.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { parseId } from '../../../utils/ids.ts'
import { render } from '../../render.tsx'
import { AdminBookFormPage } from './form.tsx'
import { AdminBooksIndexPage } from './index-page.tsx'
import { AdminBookNotFoundPage, AdminBookShowPage } from './show-page.tsx'

const textField = f.field(s.defaulted(s.string(), ''))
const optionalTextField = f.field(s.optional(s.string()))
const priceField = f.field(s.defaulted(s.string(), '0'))
const publishedYearField = f.field(s.defaulted(s.string(), '2024'), {
  name: 'publishedYear',
})
const inStockField = f.field(s.defaulted(coerce.boolean(), false), {
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
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async index({ get }) {
      let db = get(Database)
      let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] })

      return render(<AdminBooksIndexPage books={allBooks} />)
    },

    async show({ get, params }) {
      let db = get(Database)
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)

      if (!book) {
        return render(<AdminBookNotFoundPage />, { status: 404 })
      }

      return render(<AdminBookShowPage book={book} />)
    },

    new() {
      return render(
        <AdminBookFormPage
          title="Add New Book"
          action={routes.admin.books.create.href()}
          cancelHref={routes.admin.books.index.href()}
          submitLabel="Create Book"
        />,
      )
    },

    async create({ get }) {
      let db = get(Database)
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

    async edit({ get, params }) {
      let db = get(Database)
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)

      if (!book) {
        return render(<AdminBookNotFoundPage />, { status: 404 })
      }

      return render(
        <AdminBookFormPage
          title="Edit Book"
          action={routes.admin.books.update.href({ bookId: book.id })}
          cancelHref={routes.admin.books.index.href()}
          submitLabel="Update Book"
          method="PUT"
          book={book}
        />,
      )
    },

    async update({ get, params }) {
      let db = get(Database)
      let formData = get(FormData)
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)
      if (!book) {
        return new Response('Book not found', { status: 404 })
      }

      let { author, cover, description, genre, inStock, isbn, price, publishedYear, slug, title } =
        s.parse(bookSchema, formData)
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

    async destroy({ get, params }) {
      let db = get(Database)
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)
      if (book) {
        await db.delete(books, book.id)
      }

      return redirect(routes.admin.books.index.href())
    },
  },
} satisfies AppController<typeof routes.admin.books>
