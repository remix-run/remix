import { css, type Handle } from 'remix/ui'

import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { leadStyle, linkStyle, pageHeadingStyle } from '../ui/public/styles.ts'
import { NewsletterSignup, StoreScrollReproduction } from './public/scroll-restoration.tsx'

export function ScrollRestorationPage(handle: Handle<{ newsletterHistory?: 'push' | 'replace' }>) {
  return () => (
    <Document title="Navigation scroll behavior" maxWidth="860px">
      <a href={routes.home.href()} mix={linkStyle}>
        ← Back to demos
      </a>
      <h1 mix={pageHeadingStyle}>Navigation scroll behavior</h1>
      <p mix={[leadStyle, css({ lineHeight: 1.6 })]}>
        This mirrors the store issue: a top-level client entry switches between a short detail and a
        tall collection rendered by a blocking frame.
      </p>

      <StoreScrollReproduction variant="list" />

      <section
        id="scroll-restoration-list-end"
        mix={css({
          border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: 12,
          padding: 20,
          marginTop: 20,
          background: 'rgba(129,140,248,0.12)',
        })}
      >
        <h2 mix={css({ marginTop: 0, fontSize: 20 })}>End of the list</h2>
        <p mix={[leadStyle, css({ lineHeight: 1.6 })]}>
          Note <code>window.scrollY</code>, open the detail page, and return with the browser Back
          button.
        </p>
        <a
          id="scroll-restoration-detail-link"
          href={routes.scrollRestorationDetail.href()}
          mix={css({ color: '#ffffff', fontWeight: 700, textDecoration: 'underline' })}
        >
          Open the shorter detail page →
        </a>
      </section>

      <NewsletterSignup history={handle.props.newsletterHistory} />
    </Document>
  )
}

export function ScrollRestorationDetailPage() {
  return () => (
    <Document title="Navigation scroll behavior" maxWidth="860px">
      <a href={routes.home.href()} mix={linkStyle}>
        ← Back to demos
      </a>
      <h1 mix={pageHeadingStyle}>Navigation scroll behavior</h1>
      <p mix={[leadStyle, css({ lineHeight: 1.6 })]}>
        This mirrors the store issue: a top-level client entry switches between a short detail and a
        tall collection rendered by a blocking frame.
      </p>

      <StoreScrollReproduction variant="detail" />
    </Document>
  )
}
