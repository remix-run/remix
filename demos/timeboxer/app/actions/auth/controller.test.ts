import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

process.env.SESSION_SECRET = 'test-session-secret'

const { router } = await import('../../router.ts')
const { routes } = await import('../../routes.ts')
const { db, migrator, seed } = await import('../../db.ts')
await migrator.reset(db, { seed })
const { users } = await import('../../data/schema.ts')

describe('auth endpoints', () => {
  it('validates signup credentials', async () => {
    let client = createClient()
    await loadFormPage(client, routes.auth.signup.index.href())

    let shortCredentialsResponse = await submitForm(client, routes.auth.signup.action.href(), {
      username: 'ab',
      password: 'short',
    })
    assert.equal(shortCredentialsResponse.status, 400)

    let shortCredentialsHtml = await shortCredentialsResponse.text()
    assert.match(shortCredentialsHtml, /Expected at least 3 characters/)
    assert.match(shortCredentialsHtml, /Expected at least 8 characters/)
    assert.match(shortCredentialsHtml, /aria-invalid/)

    let invalidUsernameResponse = await submitForm(client, routes.auth.signup.action.href(), {
      username: 'bad username',
      password: 'password123',
    })
    assert.equal(invalidUsernameResponse.status, 400)
    assert.match(
      await invalidUsernameResponse.text(),
      /Use only letters, numbers, underscores, and dashes\./,
    )
  })

  it('rejects duplicate usernames', async () => {
    let username = uniqueUsername()
    await createSignedInClient(username)

    let client = createClient()
    await loadFormPage(client, routes.auth.signup.index.href())

    let duplicateResponse = await submitForm(client, routes.auth.signup.action.href(), {
      username,
      password: 'password123',
    })
    assert.equal(duplicateResponse.status, 409)
    assert.match(await duplicateResponse.text(), /That username is already taken\./)
  })

  it('signs up and starts a session', async () => {
    let username = uniqueUsername()
    let { client } = await createSignedInClient(username)

    let createdUser = await db.findOne(users, { where: { username } })
    assert.ok(createdUser)

    let { response, html } = await fetchHtml(client, routes.auth.index.href())
    assert.equal(response.status, 200)
    assert.match(html, new RegExp(`Welcome back, ${username}\\.`))
    assert.match(html, /Sign out/)
  })

  it('flashes invalid login credentials and renders the error', async () => {
    let username = uniqueUsername()
    await createSignedInClient(username)

    let client = createClient()
    await loadFormPage(client, routes.auth.login.index.href())

    let invalidLoginResponse = await submitForm(client, routes.auth.login.action.href(), {
      username,
      password: 'wrong-password',
    })
    assertRedirect(invalidLoginResponse, routes.auth.login.index.href(), 303)

    let { response, html } = await fetchHtml(client, routes.auth.login.index.href())
    assert.equal(response.status, 200)
    assert.match(html, /Invalid username or password\./)
    assert.match(html, /role="alert"/)
  })

  it('logs in and starts a session', async () => {
    let username = uniqueUsername()
    await createSignedInClient(username)

    let client = createClient()
    await loadFormPage(client, routes.auth.login.index.href())

    let loginResponse = await submitForm(client, routes.auth.login.action.href(), {
      username,
      password: 'password123',
    })
    assertRedirect(loginResponse, routes.home.index.href(), 303)

    let { response, html } = await fetchHtml(client, routes.auth.index.href())
    assert.equal(response.status, 200)
    assert.match(html, new RegExp(`Welcome back, ${username}\\.`))
  })

  it('logs out and clears the session', async () => {
    let username = uniqueUsername()
    let { client } = await createSignedInClient(username)
    await loadFormPage(client, routes.auth.index.href())

    let logoutResponse = await submitForm(client, routes.auth.logout.href(), {})
    assertRedirect(logoutResponse, routes.auth.login.index.href(), 303)

    let authIndexResponse = await fetchPage(client, routes.auth.index.href())
    assertRedirect(authIndexResponse, routes.auth.login.index.href())
  })

  it('redirects authenticated login and signup pages home', async () => {
    let { client } = await createSignedInClient(uniqueUsername())

    let loginResponse = await fetchPage(client, routes.auth.login.index.href())
    assertRedirect(loginResponse, routes.home.index.href())

    let signupResponse = await fetchPage(client, routes.auth.signup.index.href())
    assertRedirect(signupResponse, routes.home.index.href())
  })

  it('renders account status when signed in and redirects anonymous users to login', async () => {
    let anonymousClient = createClient()
    let anonymousResponse = await fetchPage(anonymousClient, routes.auth.index.href())
    assertRedirect(anonymousResponse, routes.auth.login.index.href())

    let username = uniqueUsername()
    let { client } = await createSignedInClient(username)

    let { response, html } = await fetchHtml(client, routes.auth.index.href())
    assert.equal(response.status, 200)
    assert.match(html, /Signed in/)
    assert.match(html, new RegExp(`Welcome back, ${username}\\.`))
  })
})

type TestClient = {
  cookie: string
  csrfToken: string | undefined
}

let nextUsernameId = 0

function createClient(): TestClient {
  return {
    cookie: '',
    csrfToken: undefined,
  }
}

async function createSignedInClient(username: string) {
  let client = createClient()
  await loadFormPage(client, routes.auth.signup.index.href())

  let signupResponse = await submitForm(client, routes.auth.signup.action.href(), {
    username,
    password: 'password123',
  })
  assertRedirect(signupResponse, routes.home.index.href(), 303)

  return { client, username }
}

async function loadFormPage(client: TestClient, path: string) {
  let result = await fetchHtml(client, path)
  assert.equal(result.response.status, 200)
  client.csrfToken = extractCsrfToken(result.html)
  return result
}

async function fetchHtml(client: TestClient, path: string) {
  let response = await fetchPage(client, path)
  let html = await response.text()
  return { response, html }
}

async function fetchPage(client: TestClient, path: string) {
  let headers = new Headers({ Accept: 'text/html' })
  if (client.cookie) headers.set('Cookie', client.cookie)

  let response = await router.fetch(new Request(url(path), { headers }))
  client.cookie = mergeCookie(client.cookie, response.headers)

  return response
}

async function submitForm(client: TestClient, path: string, fields: Record<string, string>) {
  assert.ok(client.csrfToken, 'Expected a loaded CSRF token before submitting a form')

  let formData = new FormData()
  for (let [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }
  formData.set('_csrf', client.csrfToken)

  let headers = new Headers()
  if (client.cookie) headers.set('Cookie', client.cookie)

  let response = await router.fetch(
    new Request(url(path), {
      method: 'POST',
      headers,
      body: formData,
    }),
  )
  client.cookie = mergeCookie(client.cookie, response.headers)

  return response
}

function assertRedirect(response: Response, expectedPath: string, status = 302) {
  assert.equal(response.status, status)
  let location = response.headers.get('Location')
  assert.ok(location, 'Expected a redirect location header')
  assert.equal(new URL(location, 'http://localhost').pathname, expectedPath)
}

function uniqueUsername() {
  nextUsernameId++
  return `user-${process.pid}-${Date.now()}-${nextUsernameId}`
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

