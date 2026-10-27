import { css } from 'remix/component'
import type { Handle } from 'remix/component'
import type { FormSubmission } from 'remix/data-schema/form'

import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { ContactFields } from './public/contact-form.tsx'

export function ContactPage(handle: Handle<{ submission?: FormSubmission }>) {
  return () => (
    <Layout>
      <div class="card">
        <h1>Contact Us</h1>
        <p mix={css({ margin: '1rem 0' })}>
          Have a question or feedback? We'd love to hear from you!
        </p>

        <ContactFields submission={handle.props.submission} />
      </div>
    </Layout>
  )
}

export function ContactSuccessPage() {
  return () => (
    <Layout>
      <div class="alert alert-success">Thank you for your message! We'll get back to you soon.</div>
      <div class="card">
        <p>
          <a data-rmx-prefetch="intent" href={routes.home.href()} class="btn">
            Return Home
          </a>
        </p>
      </div>
    </Layout>
  )
}
