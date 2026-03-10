import type { Controller } from 'remix/fetch-router'
import { createCookie } from 'remix/cookie'
import { css } from 'remix/component'
import { redirect } from 'remix/response/redirect'
import { getContext } from 'remix/async-context-middleware'

import { routes } from '../../config/routes.ts'
import { render } from '../../config/render.tsx'
import { Layout } from '../lib/Layout.tsx'

let authCookie = createCookie('frame-navigation-auth', {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
})

export default {
  actions: {
    async index() {
      if (!(await isAuthenticated())) {
        return redirect(routes.auth.login.index.href())
      }

      return render(
        <Layout title="Protected">
          <section mix={cardStyle}>
            <p mix={eyebrowStyle}>Protected route</p>
            <h2 mix={titleStyle}>Authenticated content</h2>
            <p mix={bodyStyle}>
              This page is guarded by a simple cookie so frame-targeted navigations can exercise
              redirect behavior.
            </p>

            <dl mix={detailsStyle}>
              <dt mix={termStyle}>Cookie</dt>
              <dd mix={definitionStyle}>
                <code>frame-navigation-auth=1</code>
              </dd>
              <dt mix={termStyle}>Redirect target</dt>
              <dd mix={definitionStyle}>{routes.auth.login.index.href()}</dd>
            </dl>

            <form method="POST" action={routes.auth.logout.href()} mix={formStyle}>
              <button type="submit" mix={secondaryButtonStyle}>
                Logout
              </button>
            </form>
          </section>
        </Layout>,
      )
    },
    login: {
      actions: {
        async index() {
          if (await isAuthenticated()) {
            return redirect(routes.auth.index.href())
          }

          return render(
            <html lang="en">
              <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Sign in | LMS</title>
                <script async type="module" src="/assets/entry.js" />
              </head>
              <body mix={loginBodyStyle}>
                <main mix={loginShellStyle}>
                  <section mix={cardStyle}>
                    <p mix={eyebrowStyle}>Demo auth</p>
                    <h2 mix={titleStyle}>Fake login page</h2>
                    <p mix={bodyStyle}>
                      This route renders outside the app shell so it is obvious the protected frame
                      navigation fell back to a top-level login page.
                    </p>

                    <form method="POST" action={routes.auth.login.action.href()} mix={formStyle}>
                      <button type="submit" mix={primaryButtonStyle}>
                        Set auth cookie
                      </button>
                    </form>
                  </section>
                </main>
              </body>
            </html>,
          )
        },
        async action() {
          return redirect(routes.auth.index.href(), {
            headers: {
              'Set-Cookie': await authCookie.serialize('1'),
            },
          })
        },
      },
    },
    async logout() {
      return redirect(routes.auth.login.index.href(), {
        headers: {
          'Set-Cookie': await authCookie.serialize('', { maxAge: 0 }),
        },
      })
    },
  },
} satisfies Controller<typeof routes.auth>

async function isAuthenticated() {
  let cookie = await authCookie.parse(getContext().request.headers.get('cookie'))
  return cookie === '1'
}

let cardStyle = css({
  maxWidth: '38rem',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  backgroundColor: '#ffffff',
  padding: '1.5rem',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
})

let loginBodyStyle = css({
  margin: 0,
  minHeight: '100vh',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
  color: '#0f172a',
  background:
    'radial-gradient(circle at top, rgba(99, 102, 241, 0.16), transparent 28%), #f8fafc',
})

let loginShellStyle = css({
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '2rem',
})

let eyebrowStyle = css({
  margin: 0,
  fontSize: '0.8rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#6366f1',
})

let titleStyle = css({
  marginTop: '0.6rem',
  marginBottom: '0.75rem',
  fontSize: '1.7rem',
  color: '#0f172a',
})

let bodyStyle = css({
  margin: 0,
  color: '#475569',
  lineHeight: 1.7,
})

let detailsStyle = css({
  marginTop: '1.25rem',
  marginBottom: 0,
  display: 'grid',
  gridTemplateColumns: '140px 1fr',
  rowGap: '0.65rem',
})

let termStyle = css({
  color: '#64748b',
})

let definitionStyle = css({
  margin: 0,
  color: '#0f172a',
  fontFamily:
    'ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, Liberation Mono, monospace',
  fontSize: '0.92rem',
})

let formStyle = css({
  marginTop: '1.5rem',
})

let primaryButtonStyle = css({
  border: 'none',
  borderRadius: '999px',
  padding: '0.8rem 1.1rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  backgroundColor: '#0f172a',
  color: '#ffffff',
})

let secondaryButtonStyle = css({
  border: 'none',
  borderRadius: '999px',
  padding: '0.8rem 1.1rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  backgroundColor: '#e2e8f0',
  color: '#0f172a',
})
