import { Frame, css, type Handle } from 'remix/ui'

import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { leadStyle, linkStyle, pageHeadingStyle, panelStyle } from '../ui/public/styles.ts'
import { ScrollRestorationDetail } from './public/scroll-restoration.tsx'

export function ScrollRestorationPage(handle: Handle<{ newsletterHistory?: 'push' | 'replace' }>) {
  return () => (
    <Document title="Navigation scroll behavior" maxWidth="860px">
      <a href={routes.home.href()} mix={linkStyle}>
        ← Back to demos
      </a>
      <h1 mix={pageHeadingStyle}>Navigation scroll behavior</h1>
      <p mix={[leadStyle, css({ lineHeight: 1.6 })]}>
        This page exercises native traversal restoration and explicit scroll preservation for new
        push and replace navigations.
      </p>

      <section mix={[panelStyle, css({ margin: '20px 0' })]}>
        <h2 mix={css({ marginTop: 0, fontSize: 18 })}>Traversal restoration</h2>
        <p mix={[leadStyle, css({ lineHeight: 1.6 })]}>
          The tall list is rendered in a blocking frame with a hydrated client entry. Traversal
          waits for that frame to finish reconciling before the browser restores scroll.
        </p>
        <ol mix={css({ marginBottom: 0, paddingLeft: 22, lineHeight: 1.7 })}>
          <li>Scroll to the end of the list and open the detail page.</li>
          <li>Scroll partway down the detail page, then use the browser Back button.</li>
          <li>Confirm this page returns to the end of the list.</li>
        </ol>
      </section>

      <Frame src={routes.frames.scrollRestorationItems.href()} />

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

function NewsletterSignup(handle: Handle<{ history?: 'push' | 'replace' }>) {
  return () => (
    <section
      aria-labelledby="newsletter-heading"
      mix={[
        panelStyle,
        css({
          marginTop: 20,
          padding: 20,
          background: 'rgba(34,197,94,0.08)',
        }),
      ]}
    >
      <h2 id="newsletter-heading" mix={css({ marginTop: 0, fontSize: 20 })}>
        Newsletter form navigation
      </h2>
      <p mix={[leadStyle, css({ lineHeight: 1.6 })]}>
        This form submits to another URL and redirects back here. Both buttons preserve the current
        scroll position with <code>data-rmx-reset-scroll="false"</code>; they differ only in whether the
        navigation pushes or replaces the history entry.
      </p>

      {handle.props.history ? (
        <p
          role="status"
          mix={css({
            border: '1px solid rgba(34,197,94,0.45)',
            borderRadius: 10,
            padding: 12,
            color: '#bbf7d0',
            background: 'rgba(34,197,94,0.12)',
          })}
        >
          Subscribed using a <strong>{handle.props.history}</strong> navigation. The form stayed in
          view after the redirect.
        </p>
      ) : null}

      <form
        method="post"
        action={routes.newsletterSignup.href()}
        data-rmx-reset-scroll="false"
        mix={css({ display: 'grid', gap: 12 })}
      >
        <label for="newsletter-email" mix={css({ display: 'grid', gap: 6 })}>
          <span mix={css({ fontWeight: 700 })}>Email address</span>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            autocomplete="email"
            required
            placeholder="you@example.com"
            mix={css({
              width: '100%',
              maxWidth: 420,
              boxSizing: 'border-box',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 10,
              padding: '10px 12px',
              color: '#e9eefc',
              background: 'rgba(255,255,255,0.06)',
            })}
          />
        </label>
        <div mix={css({ display: 'flex', flexWrap: 'wrap', gap: 10 })}>
          <button
            type="submit"
            name="history"
            value="push"
            data-rmx-history="push"
            mix={newsletterButtonStyle}
          >
            Subscribe with push
          </button>
          <button
            type="submit"
            name="history"
            value="replace"
            data-rmx-history="replace"
            mix={newsletterButtonStyle}
          >
            Subscribe with replace
          </button>
        </div>
      </form>
      <p mix={css({ marginBottom: 0, color: '#9aa8e8', fontSize: 14, lineHeight: 1.5 })}>
        After a push, Back returns to the previous entry. A replace updates the current entry
        instead. Neither submission should jump to the top of this page.
      </p>
    </section>
  )
}

const newsletterButtonStyle = css({
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#ffffff',
  background: 'rgba(129,140,248,0.35)',
  cursor: 'pointer',
  fontWeight: 700,
  '&:hover': { background: 'rgba(129,140,248,0.5)' },
  '&:focus-visible': { outline: '2px solid #a5b4fc', outlineOffset: 2 },
})

export function ScrollRestorationDetailPage() {
  return () => (
    <Document title="Scroll restoration detail" maxWidth="860px">
      <a href={routes.scrollRestoration.href()} mix={linkStyle}>
        ← Return with a new navigation
      </a>
      <h1 mix={pageHeadingStyle}>Shorter detail document</h1>
      <p mix={[leadStyle, css({ lineHeight: 1.6 })]}>
        Scroll down this page, note <code>window.scrollY</code>, then use the browser Back button.
        The link above starts a new navigation and does not test traversal restoration.
      </p>
      <ScrollRestorationDetail />
    </Document>
  )
}
