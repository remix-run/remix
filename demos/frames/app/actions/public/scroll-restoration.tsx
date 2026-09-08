import { clientEntry, Frame, css, on, type Handle } from 'remix/ui'

import { routes } from '../../routes.ts'
import { leadStyle, mutedStyle, panelStyle, sectionHeadingStyle } from '../../ui/public/styles.ts'

const listItems = Array.from({ length: 48 }, (_, index) => index + 1)

export const ScrollRestorationList = clientEntry(
  import.meta.url,
  function ScrollRestorationList(handle: Handle<{ loadedAt: string }>) {
    let interactions = 0

    return () => (
      <section id="scroll-restoration-list">
        <div
          mix={[
            panelStyle,
            css({
              position: 'sticky',
              top: 12,
              zIndex: 1,
              padding: 14,
              marginBottom: 12,
              background: '#151c35',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            }),
          ]}
        >
          <strong>Blocking frame client entry</strong>
          <span mix={[mutedStyle, css({ marginLeft: 8 })]}>
            resolved at {handle.props.loadedAt}
          </span>
          <button
            type="button"
            mix={[
              on('click', () => {
                interactions++
                handle.update()
              }),
              css({ marginLeft: 12 }),
            ]}
          >
            Frame hydration check: {interactions}
          </button>
        </div>

        <ol mix={css({ display: 'grid', gap: 10, margin: 0, padding: 0, listStyle: 'none' })}>
          {listItems.map((item) => (
            <li
              key={item}
              mix={css({
                minHeight: 76,
                display: 'flex',
                alignItems: 'center',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '0 18px',
                background: item % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
              })}
            >
              List row {item}
            </li>
          ))}
        </ol>
      </section>
    )
  },
)

export const StoreScrollReproduction = clientEntry(
  import.meta.url,
  function StoreScrollReproduction(handle: Handle<{ variant: 'list' | 'detail' }>) {
    let interactions = 0

    return () => (
      <section id="store-scroll-reproduction">
        <div
          mix={[
            panelStyle,
            css({
              position: 'sticky',
              top: 12,
              zIndex: 1,
              padding: 14,
              marginBottom: 20,
              background: '#151c35',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            }),
          ]}
        >
          <strong>Store-style top-level client entry</strong>
          <span mix={[mutedStyle, css({ marginLeft: 8 })]}>
            rendering {handle.props.variant === 'list' ? 'the collection frame' : 'a short detail'}
          </span>
          <button
            type="button"
            mix={[
              on('click', () => {
                interactions++
                handle.update()
              }),
              css({ marginLeft: 12 }),
            ]}
          >
            Hydration check: {interactions}
          </button>
        </div>

        {handle.props.variant === 'list' ? (
          <div>
            <section mix={[panelStyle, css({ marginBottom: 20 })]}>
              <h2 mix={css({ marginTop: 0, fontSize: 18 })}>Traversal restoration</h2>
              <ol mix={css({ marginBottom: 0, paddingLeft: 22, lineHeight: 1.7 })}>
                <li>Click the top-level hydration check to give the client entry local state.</li>
                <li>Scroll to the end of the collection and open the detail view.</li>
                <li>Use the browser Back button—not a return link.</li>
                <li>Confirm the hydration count and collection scroll position are restored.</li>
              </ol>
            </section>
            <Frame src={routes.frames.scrollRestorationItems.href()} />
          </div>
        ) : (
          <article
            id="scroll-restoration-detail"
            mix={[
              panelStyle,
              css({
                minHeight: 1000,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 20,
                background: 'rgba(255,255,255,0.03)',
              }),
            ]}
          >
            <div>
              <h2 mix={sectionHeadingStyle}>Short detail view</h2>
              <p mix={[leadStyle, css({ lineHeight: 1.6 })]}>
                The top-level client entry now renders much less content than the collection. Use
                the browser Back button while this short layout is present.
              </p>
            </div>
            <p mix={[leadStyle, css({ marginBottom: 0 })]}>Use the browser Back button now.</p>
          </article>
        )}
      </section>
    )
  },
)

export const NewsletterSignup = clientEntry(
  import.meta.url,
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
          This form submits to another URL and redirects back here. Both buttons preserve the
          current scroll position with <code>data-rmx-reset-scroll="false"</code>. A userland submit
          handler applies the selected history mode to the form before navigation.
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
            Subscribed using a <strong>{handle.props.history}</strong> navigation. The form stayed
            in view after the redirect.
          </p>
        ) : null}

        <form
          method="post"
          action={routes.newsletterSignup.href()}
          data-rmx-reset-scroll="false"
          mix={[
            on('submit', (event) => {
              let history = event.submitter?.getAttribute('value')
              if (history === 'push' || history === 'replace') {
                event.currentTarget.setAttribute('data-rmx-history', history)
              }
            }),
            css({ display: 'grid', gap: 12 }),
          ]}
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
            <button type="submit" name="history" value="push" mix={newsletterButtonStyle}>
              Subscribe with push
            </button>
            <button type="submit" name="history" value="replace" mix={newsletterButtonStyle}>
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
  },
)

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
