import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { auth, Auth, createSessionAuthScheme, requireAuth } from '@remix-run/auth-middleware'
import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { formData } from '@remix-run/form-data-middleware'
import { Session } from '@remix-run/session'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { completeAuth } from './complete-auth.ts'
import { createEmailOTPAuthProvider } from './providers/email-otp.ts'
import type { EmailOTPMessage } from './providers/email-otp.ts'
import { createMagicLinkAuthProvider } from './providers/magic-link.ts'
import type { MagicLinkMessage } from './providers/magic-link.ts'
import { sendEmailOTP } from './send-email-otp.ts'
import { sendMagicLink } from './send-magic-link.ts'
import { createMemoryEmailAuthStorage, createRequest } from './test-utils.ts'
import { verifyEmailOTP } from './verify-email-otp.ts'
import { verifyMagicLink } from './verify-magic-link.ts'

interface User {
  id: string
  email: string
}

function createApp() {
  let users = new Map<string, User>([['u1', { id: 'u1', email: 'mj@example.com' }]])
  let linkEmails: MagicLinkMessage[] = []
  let codeEmails: EmailOTPMessage[] = []
  let storage = createMemoryEmailAuthStorage()

  function findUserByEmail(email: string): User | undefined {
    return [...users.values()].find((user) => user.email === email)
  }

  let magicLinkProvider = createMagicLinkAuthProvider({
    storage,
    verifyUrl: 'https://app.example.com/login/email/verify',
    sendEmail(message) {
      // Only deliver to known accounts. The response is the same either way.
      if (findUserByEmail(message.email) != null) {
        linkEmails.push(message)
      }
    },
  })
  let emailOTPProvider = createEmailOTPAuthProvider({
    storage,
    secret: 'otp-secret',
    sendEmail(message) {
      codeEmails.push(message)
    },
  })

  let router = createRouter({
    middleware: [
      sessionMiddleware(
        createCookie('__session', { secrets: ['session-secret'] }),
        createMemorySessionStorage(),
      ),
      formData(),
      auth({
        schemes: [
          createSessionAuthScheme({
            read(session) {
              return session.get('auth') as { userId: string } | null
            },
            verify(value) {
              return users.get(value.userId) ?? null
            },
            invalidate(session) {
              session.unset('auth')
            },
          }),
        ],
      }),
    ],
  })

  router.get('/session', ({ get }) => {
    let session = get(Session)
    session.set('visited', true)
    return Response.json({ sessionId: session.id })
  })

  router.post('/login/email', async (context) => {
    let form = context.get(FormData)
    await sendMagicLink(magicLinkProvider, context, {
      email: String(form.get('email') ?? ''),
      returnTo: String(form.get('returnTo') ?? ''),
    })

    return new Response('Check your email for a sign-in link.')
  })

  router.get(
    '/login/email/verify',
    () =>
      new Response('<form method="post"><button>Sign in</button></form>', {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Referrer-Policy': 'no-referrer',
        },
      }),
  )

  router.post('/login/email/verify', async (context) => {
    let result = await verifyMagicLink(magicLinkProvider, context)
    if (result.status === 'failure') {
      return Response.json(result, { status: 400 })
    }

    let user = findUserByEmail(result.email)
    if (user == null) {
      user = { id: `u${users.size + 1}`, email: result.email }
      users.set(user.id, user)
    }

    let session = completeAuth(context)
    session.set('auth', { userId: user.id })

    return new Response(null, {
      status: 302,
      headers: { Location: result.returnTo ?? '/dashboard' },
    })
  })

  router.post('/login/code', async (context) => {
    let form = context.get(FormData)
    await sendEmailOTP(emailOTPProvider, context, { email: String(form.get('email') ?? '') })

    return new Response('Check your email for a sign-in code.')
  })

  router.post('/login/code/verify', async (context) => {
    let form = context.get(FormData)
    let result = await verifyEmailOTP(emailOTPProvider, context, {
      email: String(form.get('email') ?? ''),
      code: String(form.get('code') ?? ''),
    })

    if (result.status === 'failure') {
      return Response.json(result, { status: 400 })
    }

    let user = findUserByEmail(result.email)
    if (user == null) {
      return Response.json({ status: 'failure', code: 'invalid_code' }, { status: 400 })
    }

    let session = completeAuth(context)
    session.set('auth', { userId: user.id })

    return new Response(null, { status: 302, headers: { Location: '/dashboard' } })
  })

  router.get('/dashboard', {
    middleware: [requireAuth()],
    handler({ get }) {
      return Response.json(get(Auth))
    },
  })

  return { router, linkEmails, codeEmails }
}

function postForm(url: string, fields: Record<string, string>, fromResponse?: Response): Request {
  return createRequest(url, fromResponse, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  })
}

describe('email auth flow integration', () => {
  it('signs in with a magic link, rotates the session id, and rejects replays', async () => {
    let { router, linkEmails } = createApp()

    let sessionResponse = await router.fetch('https://app.example.com/session')
    let { sessionId: anonymousSessionId } = await sessionResponse.json()

    await router.fetch(
      postForm(
        'https://app.example.com/login/email',
        { email: 'MJ@example.com', returnTo: '/dashboard?tab=profile' },
        sessionResponse,
      ),
    )
    let linkURL = linkEmails[0].url

    let scannerResponse = await router.fetch(linkURL)
    assert.equal(scannerResponse.status, 200)
    assert.equal(scannerResponse.headers.get('Referrer-Policy'), 'no-referrer')

    let verifyResponse = await router.fetch(postForm(linkURL, {}, sessionResponse))
    assert.equal(verifyResponse.status, 302)
    assert.equal(verifyResponse.headers.get('Location'), '/dashboard?tab=profile')

    let dashboardResponse = await router.fetch(
      createRequest('https://app.example.com/dashboard', verifyResponse),
    )
    assert.deepEqual(await dashboardResponse.json(), {
      ok: true,
      identity: { id: 'u1', email: 'mj@example.com' },
      method: 'session',
    })

    let rotatedSessionResponse = await router.fetch(
      createRequest('https://app.example.com/session', verifyResponse),
    )
    let { sessionId: authenticatedSessionId } = await rotatedSessionResponse.json()
    assert.notEqual(authenticatedSessionId, anonymousSessionId)

    let replayResponse = await router.fetch(postForm(linkURL, {}))
    assert.equal(replayResponse.status, 400)
    assert.deepEqual(await replayResponse.json(), { status: 'failure', code: 'invalid_token' })
  })

  it('signs in whichever browser redeems the magic link', async () => {
    let { router, linkEmails } = createApp()

    let requestingBrowser = await router.fetch('https://app.example.com/session')
    await router.fetch(
      postForm(
        'https://app.example.com/login/email',
        { email: 'mj@example.com' },
        requestingBrowser,
      ),
    )

    let otherBrowserResponse = await router.fetch(postForm(linkEmails[0].url, {}))
    let otherBrowserDashboard = await router.fetch(
      createRequest('https://app.example.com/dashboard', otherBrowserResponse),
    )
    let requestingBrowserDashboard = await router.fetch(
      createRequest('https://app.example.com/dashboard', requestingBrowser),
    )

    assert.equal(otherBrowserDashboard.status, 200)
    assert.equal(requestingBrowserDashboard.status, 401)
  })

  it('returns the same response for known and unknown addresses', async () => {
    let { router, linkEmails } = createApp()

    let knownResponse = await router.fetch(
      postForm('https://app.example.com/login/email', { email: 'mj@example.com' }),
    )
    let unknownResponse = await router.fetch(
      postForm('https://app.example.com/login/email', { email: 'nobody@example.com' }),
    )

    assert.equal(knownResponse.status, unknownResponse.status)
    assert.equal(await knownResponse.text(), await unknownResponse.text())
    assert.deepEqual(
      linkEmails.map((message) => message.email),
      ['mj@example.com'],
    )
  })

  it('signs in with an email code and rotates the session id', async () => {
    let { router, codeEmails } = createApp()

    let sessionResponse = await router.fetch('https://app.example.com/session')
    let { sessionId: anonymousSessionId } = await sessionResponse.json()

    await router.fetch(
      postForm('https://app.example.com/login/code', { email: 'mj@example.com' }, sessionResponse),
    )
    let code = codeEmails[0].code
    let wrongCode = code.replace(/^\d/, (digit) => String((Number(digit) + 1) % 10))

    let wrongResponse = await router.fetch(
      postForm(
        'https://app.example.com/login/code/verify',
        { email: 'mj@example.com', code: wrongCode },
        sessionResponse,
      ),
    )
    assert.equal(wrongResponse.status, 400)
    assert.deepEqual(await wrongResponse.json(), {
      status: 'failure',
      code: 'invalid_code',
      attemptsRemaining: 2,
    })

    let verifyResponse = await router.fetch(
      postForm(
        'https://app.example.com/login/code/verify',
        { email: 'mj@example.com', code },
        sessionResponse,
      ),
    )
    assert.equal(verifyResponse.status, 302)

    let dashboardResponse = await router.fetch(
      createRequest('https://app.example.com/dashboard', verifyResponse),
    )
    assert.equal(dashboardResponse.status, 200)

    let rotatedSessionResponse = await router.fetch(
      createRequest('https://app.example.com/session', verifyResponse),
    )
    let { sessionId: authenticatedSessionId } = await rotatedSessionResponse.json()
    assert.notEqual(authenticatedSessionId, anonymousSessionId)
  })
})
