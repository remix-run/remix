import { css } from 'remix/component'

import type { Book } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { Layout } from '../../../ui/layout.tsx'

export function AdminBooksIndexPage() {
  return ({ books }: { books: Book[] }) => (
    <Layout>
      <h1>Manage Books</h1>

      <p mix={css({ marginBottom: '1rem' })}>
        <a href={routes.admin.books.new.href()} class="btn">
          Add New Book
        </a>
        <a
          href={routes.admin.index.href()}
          class="btn btn-secondary"
          mix={css({ marginLeft: '0.5rem' })}
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
            {books.map((book) => (
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
                    mix={css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })}
                  >
                    Edit
                  </a>
                  <RestfulForm
                    method="DELETE"
                    action={routes.admin.books.destroy.href({ bookId: book.id })}
                    mix={css({ display: 'inline' })}
                  >
                    <button
                      type="submit"
                      class="btn btn-danger"
                      mix={css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })}
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
    </Layout>
  )
}
