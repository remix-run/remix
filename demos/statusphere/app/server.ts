import * as http from 'node:http'

import { ComAtprotoRepoCreateRecord, ComAtprotoRepoListRecords } from '@atcute/atproto'
import { isActorIdentifier, type Did } from '@atcute/lexicons/syntax'
import * as v from '@atcute/lexicons/validations'
import { ok } from '@atcute/client'
// @ts-expect-error - no idea why this type-errors
import * as TID from '@atcute/tid'
import { requireAtcute } from '@remix-run/atcute'
import { createRequestListener } from 'remix/node-fetch-server'
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import { createCookieSessionStorage } from 'remix/session/cookie-storage'
import { session } from 'remix/session-middleware'
import { html } from 'remix/html-template'
import { createHtmlResponse } from 'remix/response/html'

import { auth } from './auth.ts'
import { routes } from './routes.ts'
import { XyzStatusphereStatus } from './lexicons/index.ts'

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
    let user = auth.getUser(false)

    let authError: string | undefined
    let statusError: string | undefined

    if (request.method === 'POST') {
      let formData = await request.formData()
      switch (formData.get('_intent')) {
        case 'set-status':
          if (!user || user.type !== 'atcute') {
            statusError = 'Not authenticated'
            break
          }
          try {
            let client = await requireAtcute()

            let status = formData.get('status')

            let rkey = TID.now()
            let createdAt = new Date().toISOString()

            let record = {
              $type: 'xyz.statusphere.status',
              createdAt: createdAt,
              status: status,
            }

            if (!v.is(XyzStatusphereStatus.mainSchema, record)) {
              break
            }

            await ok(
              client.call(ComAtprotoRepoCreateRecord, {
                input: {
                  repo: user.id as Did,
                  collection: 'xyz.statusphere.status',
                  rkey: rkey,
                  record,
                },
              }),
            )
          } catch {
            statusError = 'Failed to set status'
          }
          break
        case 'logout':
          user = null
          auth.logout()
          break
        case 'login':
          let handle = formData.get('handle')
          handle = typeof handle === 'string' ? handle.trim() : handle
          if (typeof handle !== 'string' || !handle || !isActorIdentifier(handle)) {
            authError = 'Invalid handle'
            break
          }

          let redirectTo = await auth.authorize('atcute', handle)
          if (!redirectTo) authError = 'Failed to authorize'
          else return Response.redirect(redirectTo, 302)

          break
      }
    }

    let profile = await auth.getProfile(false)
    let displayName =
      profile?.bsky?.displayName || profile?.bsky?.handle || profile?.did || user?.id

    let latestStatus: XyzStatusphereStatus.Main | undefined
    if (user && user.type === 'atcute') {
      let client = await requireAtcute()
      let {
        records: [status],
      } = await ok(
        client.call(ComAtprotoRepoListRecords, {
          params: {
            collection: 'xyz.statusphere.status',
            repo: user.id as Did,
            limit: 1,
          },
        }),
      )
      latestStatus = status.value as XyzStatusphereStatus.Main
    }

    return createHtmlResponse(html`
      <html>
        <head>
          <title>Statusphere</title>
          <link
            rel="stylesheet"
            href="https://davidpaulsson.github.io/no-class/css/no-class.min.css"
          />
        </head>
        <body>
          <main>
            <h1>Hello, ${displayName || 'World'}!</h1>
            ${displayName
              ? html`
                  <details>
                    <summary>Profile</summary>
                    <pre><code>${JSON.stringify(profile, null, 2)}</code></pre>
                  </details>
                  <hr />
                  <form method="post">
                    <input type="hidden" name="_intent" value="logout" />
                    <fieldset>
                      <legend>Logout</legend>
                      ${authError ? html`<div>${authError}</div>` : null}
                      <button>Logout</button>
                    </fieldset>
                  </form>
                  <hr />
                  ${latestStatus
                    ? html`<h2>
                        ${latestStatus.status} -
                        ${new Intl.DateTimeFormat('en-US', {
                          timeZone: 'America/Los_Angeles',
                          dateStyle: 'short',
                          timeStyle: 'long',
                        }).format(new Date(latestStatus.createdAt))}
                      </h2>`
                    : null}
                  <form method="post">
                    <input type="hidden" name="_intent" value="set-status" />
                    <fieldset>
                      <legend>Set Status</legend>
                      ${statusError ? html`<div>${statusError}</div>` : null}
                      <button type="submit" name="status" required disabled>Select a status</button>
                      <div>
                        <emoji-picker></emoji-picker>
                      </div>
                    </fieldset>
                  </form>
                  <script type="module">
                    import 'https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js'

                    document.querySelector('emoji-picker').addEventListener('emoji-click', (e) => {
                      let button = document.querySelector('button[name=status]')
                      button.innerText = 'Set status to ' + e.detail.unicode
                      button.value = e.detail.unicode
                      button.disabled = false
                    })
                  </script>
                `
              : html`
                  <form method="post">
                    <input type="hidden" name="_intent" value="login" />
                    <fieldset>
                      <legend>Login</legend>
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
                      ${authError ? html`<div>${authError}</div>` : null}
                      <button>Login</button>
                    </fieldset>
                  </form>
                `}
          </main>
        </body>
      </html>
    `)
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
  console.log(`Statusphere is running at http://127.0.0.1:${port}/`)
})
