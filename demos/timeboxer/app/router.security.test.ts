import { rmSync } from 'node:fs'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

process.env.SESSION_SECRET = 'test-session-secret'
const databaseUrl = `./tmp/security-test-${process.pid}-${Date.now()}.sqlite`
process.env.DATABASE_URL = databaseUrl

const { router } = await import('./router.ts')
const { routes } = await import('./routes.ts')

describe('security middleware', () => {
  it('rejects auth mutations with missing or invalid CSRF tokens', async () => {
    let anonymousSession = await createAnonymousSession()

    await assertCsrfRejection(
      formRequest(routes.auth.signup.action.href(), {
        cookie: anonymousSession.cookie,
        fields: {
          username: uniqueUsername('missing-signup'),
          password: 'password123',
        },
        method: 'POST',
      }),
      'missing',
    )

    await assertCsrfRejection(
      formRequest(routes.auth.signup.action.href(), {
        cookie: anonymousSession.cookie,
        csrfToken: 'invalid-token',
        fields: {
          username: uniqueUsername('invalid-signup'),
          password: 'password123',
        },
        method: 'POST',
      }),
      'invalid',
    )

    await assertCsrfRejection(
      formRequest(routes.auth.login.action.href(), {
        cookie: anonymousSession.cookie,
        fields: {
          username: 'missing-login',
          password: 'password123',
        },
        method: 'POST',
      }),
      'missing',
    )

    await assertCsrfRejection(
      formRequest(routes.auth.login.action.href(), {
        cookie: anonymousSession.cookie,
        csrfToken: 'invalid-token',
        fields: {
          username: 'invalid-login',
          password: 'password123',
        },
        method: 'POST',
      }),
      'invalid',
    )

    let authenticatedSession = await createAuthenticatedSession()

    await assertCsrfRejection(
      formRequest(routes.auth.logout.href(), {
        cookie: authenticatedSession.cookie,
        method: 'POST',
      }),
      'missing',
    )

    await assertCsrfRejection(
      formRequest(routes.auth.logout.href(), {
        cookie: authenticatedSession.cookie,
        csrfToken: 'invalid-token',
        method: 'POST',
      }),
      'invalid',
    )
  })

  it('rejects schedule mutations with missing or invalid CSRF tokens', async () => {
    let session = await createAuthenticatedSession()
    let schedule = await createSchedule(session, 'csrf baseline schedule')

    await assertCsrfRejection(
      jsonRequest(routes.schedules.create.href(), {
        body: { name: 'missing csrf schedule' },
        cookie: session.cookie,
        method: 'POST',
      }),
      'missing',
    )

    await assertCsrfRejection(
      jsonRequest(routes.schedules.create.href(), {
        body: { name: 'invalid csrf schedule' },
        cookie: session.cookie,
        csrfToken: 'invalid-token',
        method: 'POST',
      }),
      'invalid',
    )

    await assertCsrfRejection(
      jsonRequest(routes.schedules.update.href({ scheduleId: String(schedule.id) }), {
        body: {
          name: schedule.name,
          baseRevision: schedule.revision,
          blocks: [],
        },
        cookie: session.cookie,
        method: 'PUT',
      }),
      'missing',
    )

    await assertCsrfRejection(
      jsonRequest(routes.schedules.update.href({ scheduleId: String(schedule.id) }), {
        body: {
          name: schedule.name,
          baseRevision: schedule.revision,
          blocks: [],
        },
        cookie: session.cookie,
        csrfToken: 'invalid-token',
        method: 'PUT',
      }),
      'invalid',
    )

    await assertCsrfRejection(
      jsonRequest(routes.schedules.destroy.href({ scheduleId: String(schedule.id) }), {
        cookie: session.cookie,
        method: 'DELETE',
      }),
      'missing',
    )

    await assertCsrfRejection(
      jsonRequest(routes.schedules.destroy.href({ scheduleId: String(schedule.id) }), {
        cookie: session.cookie,
        csrfToken: 'invalid-token',
        method: 'DELETE',
      }),
      'invalid',
    )
  })

  it('accepts valid CSRF tokens for auth and schedule mutations', async () => {
    let anonymousSession = await createAnonymousSession()

    let signupResponse = await router.fetch(
      formRequest(routes.auth.signup.action.href(), {
        cookie: anonymousSession.cookie,
        csrfToken: anonymousSession.csrfToken,
        fields: {
          username: uniqueUsername('valid-signup'),
          password: 'password123',
        },
        method: 'POST',
      }),
    )

    assert.equal(signupResponse.status, 303)

    let session = await createAuthenticatedSession()
    let createScheduleResponse = await router.fetch(
      jsonRequest(routes.schedules.create.href(), {
        body: { name: 'valid csrf schedule' },
        cookie: session.cookie,
        csrfToken: session.csrfToken,
        method: 'POST',
      }),
    )

    assert.equal(createScheduleResponse.status, 201)
  })
})

type SessionFixture = {
  cookie: string
  csrfToken: string
}

async function createAnonymousSession(): Promise<SessionFixture> {
  let response = await router.fetch(pageRequest(routes.auth.signup.index.href()))
  let cookie = mergeCookie('', response.headers)
  let csrfToken = extractCsrfToken(await response.text())

  return { cookie, csrfToken }
}

async function createAuthenticatedSession(): Promise<SessionFixture> {
  let session = await createAnonymousSession()

  let signupResponse = await router.fetch(
    formRequest(routes.auth.signup.action.href(), {
      cookie: session.cookie,
      csrfToken: session.csrfToken,
      fields: {
        username: uniqueUsername('auth'),
        password: 'password123',
      },
      method: 'POST',
    }),
  )

  assert.equal(signupResponse.status, 303)
  let cookie = mergeCookie(session.cookie, signupResponse.headers)

  let homeResponse = await router.fetch(
    pageRequest(routes.home.index.href(), {
      cookie,
    }),
  )

  cookie = mergeCookie(cookie, homeResponse.headers)
  let csrfToken = extractCsrfToken(await homeResponse.text())

  return { cookie, csrfToken }
}

async function createSchedule(session: SessionFixture, name: string) {
  let response = await router.fetch(
    jsonRequest(routes.schedules.create.href(), {
      body: { name },
      cookie: session.cookie,
      csrfToken: session.csrfToken,
      method: 'POST',
    }),
  )

  assert.equal(response.status, 201)

  let json = await response.json()
  return json.schedule as {
    id: number
    name: string
    revision: number
  }
}

async function assertCsrfRejection(request: Request, reason: 'invalid' | 'missing') {
  let response = await router.fetch(request)

  assert.equal(response.status, 403)
  assert.equal(await response.text(), `Forbidden: ${reason} CSRF token`)
}

function pageRequest(path: string, init?: { cookie?: string }) {
  let headers = new Headers({ Accept: 'text/html' })
  if (init?.cookie) headers.set('Cookie', init.cookie)

  return new Request(url(path), { headers })
}

function formRequest(
  path: string,
  init: {
    cookie?: string
    csrfToken?: string
    fields?: Record<string, string>
    method: string
  },
) {
  let formData = new FormData()

  for (let [name, value] of Object.entries(init.fields ?? {})) {
    formData.set(name, value)
  }

  if (init.csrfToken !== undefined) {
    formData.set('_csrf', init.csrfToken)
  }

  let headers = new Headers()
  if (init.cookie) headers.set('Cookie', init.cookie)

  return new Request(url(path), {
    body: formData,
    headers,
    method: init.method,
  })
}

function jsonRequest(
  path: string,
  init: {
    body?: unknown
    cookie?: string
    csrfToken?: string
    method: string
  },
) {
  let headers = new Headers({ Accept: 'application/json' })
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  if (init.cookie) headers.set('Cookie', init.cookie)
  if (init.csrfToken !== undefined) headers.set('X-Csrf-Token', init.csrfToken)

  return new Request(url(path), {
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers,
    method: init.method,
  })
}

function url(path: string) {
  return new URL(path, 'http://localhost').href
}

function extractCsrfToken(html: string) {
  let match = html.match(/<input[^>]*name="_csrf"[^>]*value="([^"]+)"/)
  assert.ok(match, 'Expected rendered page to include a CSRF input')
  return match[1]!
}

function mergeCookie(currentCookie: string, headers: Headers) {
  let setCookie = headers.get('Set-Cookie')
  if (!setCookie) return currentCookie

  let cookiePair = setCookie.split(';', 1)[0]!
  if (!currentCookie) return cookiePair

  let cookieName = cookiePair.split('=', 1)[0]
  let existingPairs = currentCookie
    .split('; ')
    .filter((pair) => pair.split('=', 1)[0] !== cookieName)

  return [...existingPairs, cookiePair].join('; ')
}

let usernameCounter = 0

function uniqueUsername(prefix: string) {
  return `${prefix.slice(0, 16)}-${process.pid}-${usernameCounter++}`
}

process.on('exit', () => {
  rmSync(databaseUrl, { force: true })
})
