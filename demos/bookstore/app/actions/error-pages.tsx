import { css } from 'remix/component'

import { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'

export function NotFoundPage() {
  return () => (
    <Layout title="Page Not Found | Bookstore">
      <div class="card">
        <h1>Page Not Found</h1>
        <p mix={css({ margin: '1rem 0' })}>
          We couldn't find the page you were looking for. Check the URL or keep browsing.
        </p>
        <p>
          <a data-rmx-prefetch="intent" href={routes.home.href()} class="btn">
            Back Home
          </a>
          <a
            data-rmx-prefetch="intent"
            href={routes.books.index.href()}
            class="btn btn-secondary"
            mix={css({ marginLeft: '1rem' })}
          >
            Browse Books
          </a>
        </p>
      </div>
    </Layout>
  )
}

export function ErrorPage() {
  return () => (
    <Layout title="Something Went Wrong | Bookstore">
      <div class="card">
        <h1>Something Went Wrong</h1>
        <p mix={css({ margin: '1rem 0' })}>
          We hit an unexpected problem loading this page. Please try again in a moment.
        </p>
        <p>
          <a data-rmx-prefetch="intent" href={routes.home.href()} class="btn">
            Back Home
          </a>
        </p>
      </div>
    </Layout>
  )
}
