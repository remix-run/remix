import * as http from 'node:http'

import { isActorIdentifier } from '@atcute/lexicons/syntax'
import { createRequestListener } from 'remix/node-fetch-server'
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import { createCookieSessionStorage } from 'remix/session/cookie-storage'
import { session } from 'remix/session-middleware'
import { html } from 'remix/html-template'
import { createHtmlResponse } from 'remix/response/html'

import { auth } from './auth.ts'
import { routes } from './routes.ts'

let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44400

let sessionCookie = createCookie('__session', {
  httpOnly: true,
  sameSite: 'Lax',
  secrets: ['s3cr3t'], // session cookies must be signed!
  secure: true,
  path: '/',
})

let sessionStorage = createCookieSessionStorage()

let router = createRouter({
  middleware: [session(sessionCookie, sessionStorage), auth.load],
})

router.map(routes, {
  async home({ request }) {
    let url = new URL(request.url)
    let user = auth.getUser(false)

    let status = 200
    let headers = new Headers()
    let atprotoError: string | undefined

    if (request.method === 'POST') {
      let formData = await request.formData()
      switch (formData.get('_intent')) {
        case 'logout':
          let isbasicAuth = user?.type === 'basic'
          user = null
          auth.logout()
          if (isbasicAuth) {
            status = 401
            headers.set('WWW-Authenticate', 'Basic realm="Auth Example"')
          } else {
            return new Response('', {
              status: 302,
              headers: {
                Location: routes.home.href(),
              },
            })
          }
          break
        case 'atproto-login':
          let handle = formData.get('handle')
          handle = typeof handle === 'string' ? handle.trim() : handle
          if (typeof handle !== 'string' || !handle || !isActorIdentifier(handle)) {
            atprotoError = 'Invalid handle'
            status = 400
            break
          }

          let redirectTo = await auth.authorize('atcute', handle)
          if (!redirectTo) {
            atprotoError = 'Failed to authorize'
            status = 400
          } else return Response.redirect(redirectTo)

          break
      }
    }

    let profile = await auth.getProfile(false)

    if (url.searchParams.has('basic-auth') && user?.type !== 'basic') {
      status = 401
      headers.set('WWW-Authenticate', 'Basic realm="Auth Example"')
    }

    return createHtmlResponse(
      html`
        <html>
          <head>
            <title>Auth Example</title>
            <link
              rel="stylesheet"
              href="https://davidpaulsson.github.io/no-class/css/no-class.min.css"
            />
          </head>
          <body>
            <main>
              <h1>Hello, ${user ? 'User' : 'World'}!</h1>
              ${user
                ? html`
                    <details>
                      <summary>Info</summary>
                      <pre><code>${JSON.stringify({ user, profile }, null, 2)}</code></pre>
                    </details>
                    <hr />
                    <form method="post">
                      <input type="hidden" name="_intent" value="logout" />
                      <fieldset>
                        <legend>Logout</legend>
                        ${atprotoError ? html`<div>${atprotoError}</div>` : null}
                        <button>Logout</button>
                      </fieldset>
                    </form>
                  `
                : html`
                    <form>
                      <input type="hidden" name="basic-auth" />
                      <fieldset>
                        <legend>Basic auth</legend>
                        <button type="submit">Login</button>
                      </fieldset>
                    </form>
                    <form method="post">
                      <input type="hidden" name="_intent" value="atproto-login" />
                      <fieldset>
                        <legend>Atcute</legend>
                        <label>
                          <span>ATProto Handle</span>
                          <input
                            type="text"
                            name="handle"
                            autocomplete="handle"
                            autocorrect="off"
                            autocapitalize="off"
                          />
                        </label>
                        ${atprotoError ? html`<div>${atprotoError}</div>` : null}
                        <button>Login</button>
                      </fieldset>
                    </form>
                  `}
            </main>
          </body>
        </html>
      `,
      {
        headers,
        status,
      },
    )
  },
  oauth: {
    async atproto({ url }) {
      await auth.callback('atcute', url.searchParams)
      return Response.redirect(`http://127.0.0.1:${port}/`, 302)
    },
  },
})

let server = http.createServer(
  createRequestListener(async (request) => {
    return router.fetch(request)
  }),
)

server.listen(port, '127.0.0.1', () => {
  console.log(`Auth example is running at http://127.0.0.1:${port}/`)
})
