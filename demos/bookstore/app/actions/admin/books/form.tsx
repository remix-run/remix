import type { Handle } from 'remix/component'
import type { FormSubmission } from 'remix/data-schema/form'

import type { Book } from '../../../data/schema.ts'
import { Layout } from '../../../ui/layout.tsx'
import { AdminBookFields } from './public/book-form.tsx'

export interface AdminBookFormPageProps {
  title: string
  action: string
  cancelHref: string
  submitLabel: string
  method?: 'POST' | 'PUT'
  book?: Book
  submission?: FormSubmission
}

export function AdminBookFormPage(handle: Handle<AdminBookFormPageProps>) {
  return () => {
    let { action, book, cancelHref, method = 'POST', submitLabel, title, submission } = handle.props

    return (
      <Layout>
        <h1>{title}</h1>

        <div class="card">
          <AdminBookFields
            action={action}
            cancelHref={cancelHref}
            submitLabel={submitLabel}
            method={method}
            book={book}
            submission={submission}
          />
        </div>
      </Layout>
    )
  }
}
