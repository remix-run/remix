import type { BuildRouteHandler, Middleware, RouteHandlers } from '@remix-run/fetch-router'
import assert from 'node:assert'
import * as res from '@remix-run/fetch-router/response-helpers'
import * as templates from './layout.ts'

import { routes } from '../routes.ts'
import { html } from '@remix-run/html-template'

function requireGuest(): Middleware {
  return async (context, next) => {
    let username = context.session.get('username')
    if (username) {
      return res.redirect(routes.posts.index.href())
    }
    return next()
  }
}

export let login = {
  middleware: [requireGuest()],
  handlers: {
    index({ session, url }) {
      let error = session.get('error') as string | undefined
      let currentUser = session.get('username') as string | undefined
      let redirectTo = url.searchParams.get('redirectTo') || ''

      // TODO: check if this should be cleared on subsequent requests, given that we used flash to set the error
      session.destroy()

      return res.html(
        templates.layout(
          html`
            <h1>Login</h1>
            ${error ? html`<p style="color: red;">${error}</p>` : null}
            <form method="POST" action="${routes.login.action.href()}">
              ${redirectTo
                ? html`<input type="hidden" name="redirectTo" value="${redirectTo}" />`
                : null}
              <div>
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required />
              </div>
              <div>
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required autocomplete="off" />
              </div>
              <button type="submit">Login</button>
            </form>
            <p><a href="${routes.home.href()}">← Back to Home</a></p>
          `,
          currentUser,
        ),
        // This feels incorrect for the GET request to return a 400, I feel like maybe I'm using flash wrong 🤔
        { status: error ? 400 : 200 },
      )
    },
    action({ formData, session }) {
      let username = formData.get('username')
      let password = formData.get('password') as string
      let redirectTo = formData.get('redirectTo') as string | null

      try {
        // Simple auth - in real app, check against database
        assert.ok(username !== 'ryan', 'Invalid user, ryan is not allowed')
        assert.ok(typeof username === 'string', 'Invalid username')
        assert.ok(typeof password === 'string', 'Invalid password')

        session.set('username', username)
        let redirectUrl =
          redirectTo && redirectTo.startsWith('/') ? redirectTo : routes.posts.index.href()
        return res.redirect(redirectUrl)
      } catch (error) {
        session.flash(
          'error',
          error instanceof Error ? error.message : 'Oops, something went wrong',
        )

        let redirectUrl = redirectTo
          ? `${routes.login.index.href()}?redirectTo=${encodeURIComponent(redirectTo)}`
          : routes.login.index.href()
        return res.redirect(redirectUrl)
      }
    },
  },
} satisfies RouteHandlers<typeof routes.login>

type LogoutRoute = typeof routes.logout

export let logout: BuildRouteHandler<'POST', LogoutRoute> = ({ session }) => {
  session.destroy()
  return res.redirect(routes.home.href())
}
