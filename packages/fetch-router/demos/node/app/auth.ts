import type { BuildRouteHandler, Middleware, RouteHandlers } from '@remix-run/fetch-router'
import { html } from '@remix-run/html-template'
import * as res from '@remix-run/fetch-router/response-helpers'

import { routes } from '../routes.ts'
import * as templates from './templates.ts'
import { loginUrl } from './utils.ts'

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
      let redirectTo = url.searchParams.get('redirectTo')

      // TODO: check if this should be cleared on subsequent requests, given that we used flash to set the error
      if (error) {
        session.unset('error')
      }

      return res.html(
        templates.layout(
          html`
            <h1>Login</h1>
            ${error ? html`<p class="error-message">${error}</p>` : null}
            <form class="form-spaced" method="POST" action="${routes.login.action.href()}">
              ${templates.redirectToInput(redirectTo)}
              <div class="form-field">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required />
              </div>
              <div class="form-field">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required autocomplete="off" />
              </div>
              <button type="submit">Login</button>
            </form>
            <p class="form-actions"><a href="${routes.home.href()}">← Back to Home</a></p>
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
      let redirectTo = formData.get('redirectTo')

      let error = null

      if (!username || !password) {
        error = 'Username and password are required'
      }

      if (username === 'ryan') {
        error = 'Invalid user, ryan is not allowed'
      }

      if (error) {
        session.flash('error', error)
        return res.redirect(loginUrl(redirectTo))
      }

      session.set('username', username)

      let redirectUrl =
        typeof redirectTo === 'string' && redirectTo.startsWith('/')
          ? redirectTo
          : routes.posts.index.href()
      return res.redirect(redirectUrl)
    },
  },
} satisfies RouteHandlers<typeof routes.login>

type LogoutRoute = typeof routes.logout

export let logout: BuildRouteHandler<'POST', LogoutRoute> = ({ session }) => {
  session.destroy()
  return res.redirect(routes.home.href())
}
