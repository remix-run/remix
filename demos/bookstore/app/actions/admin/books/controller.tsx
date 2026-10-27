import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { books } from '../../../data/schema.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { resolveBookCover } from '../../../utils/book-images.ts'
import { parseId } from '../../../utils/ids.ts'
import { AdminBookFormPage } from './form.tsx'
import { AdminBooksIndexPage } from './index-page.tsx'
import { AdminBookForm } from './public/schema.ts'
import { AdminBookNotFoundPage, AdminBookShowPage } from './show-page.tsx'

export default createController(routes.admin.books, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async index({ db, render }) {
      let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] })

      return render(<AdminBooksIndexPage books={allBooks} />)
    },

    async show({ db, params, render }) {
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)

      if (!book) {
        return render(<AdminBookNotFoundPage />, { status: 404 })
      }

      return render(<AdminBookShowPage book={book} />)
    },

    new({ render }) {
      return render(
        <AdminBookFormPage
          title="Add New Book"
          action={routes.admin.books.create.href()}
          cancelHref={routes.admin.books.index.href()}
          submitLabel="Create Book"
        />,
      )
    },

    async create({ db, formData, render }) {
      let submission = AdminBookForm.parseSafe(formData)
      if (!submission.success) {
        return render(
          <AdminBookFormPage
            title="Add New Book"
            action={routes.admin.books.create.href()}
            cancelHref={routes.admin.books.index.href()}
            submitLabel="Create Book"
            submission={submission}
          />,
          { status: 400 },
        )
      }
      let { author, cover, description, genre, inStock, isbn, price, publishedYear, slug, title } =
        submission.value

      await db.create(books, {
        slug,
        title,
        author,
        description,
        price,
        genre,
        cover_url: cover ?? '/images/placeholder.jpg',
        image_urls: JSON.stringify([]),
        isbn,
        published_year: publishedYear,
        in_stock: inStock,
      })

      return redirect(routes.admin.books.index.href())
    },

    async edit({ db, params, render }) {
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)

      if (!book) {
        return render(<AdminBookNotFoundPage />, { status: 404 })
      }

      book = await resolveBookCover(book)

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

    async update({ db, formData, params, render }) {
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)
      if (!book) {
        return new Response('Book not found', { status: 404 })
      }

      let submission = AdminBookForm.parseSafe(formData)
      if (!submission.success) {
        book = await resolveBookCover(book)
        return render(
          <AdminBookFormPage
            title="Edit Book"
            action={routes.admin.books.update.href({ bookId: book.id })}
            cancelHref={routes.admin.books.index.href()}
            submitLabel="Update Book"
            method="PUT"
            book={book}
            submission={submission}
          />,
          { status: 400 },
        )
      }
      let { author, cover, description, genre, inStock, isbn, price, publishedYear, slug, title } =
        submission.value
      let cover_url = cover || book.cover_url

      await db.update(books, book.id, {
        slug,
        title,
        author,
        description,
        price,
        genre,
        cover_url,
        isbn,
        published_year: publishedYear,
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
})
