import type { Controller } from 'remix/fetch-router'
import { css } from 'remix/component'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../../routes.ts'
import { render } from '../../../utils/render.tsx'
import { authCookie, isAuthenticated } from '../../../middleware/auth.ts'

export default {
  actions: {
    async index() {
      if (await isAuthenticated()) {
        return redirect(routes.main.index.href())
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
      return redirect(routes.main.index.href(), {
        headers: {
          'Set-Cookie': await authCookie.serialize('1'),
        },
      })
    },
  },
} satisfies Controller<typeof routes.auth.login>

const cardStyle = css({
  maxWidth: '38rem',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  backgroundColor: '#ffffff',
  padding: '1.5rem',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
})

const loginBodyStyle = css({
  margin: 0,
  minHeight: '100vh',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
  color: '#0f172a',
  background: 'radial-gradient(circle at top, rgba(99, 102, 241, 0.16), transparent 28%), #f8fafc',
})

const loginShellStyle = css({
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '2rem',
})

const eyebrowStyle = css({
  margin: 0,
  fontSize: '0.8rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#6366f1',
})

const titleStyle = css({
  marginTop: '0.6rem',
  marginBottom: '0.75rem',
  fontSize: '1.7rem',
  color: '#0f172a',
})

const bodyStyle = css({
  margin: 0,
  color: '#475569',
  lineHeight: 1.7,
})

const formStyle = css({
  marginTop: '1.5rem',
})

const primaryButtonStyle = css({
  border: 'none',
  borderRadius: '999px',
  padding: '0.8rem 1.1rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  backgroundColor: '#0f172a',
  color: '#ffffff',
})
