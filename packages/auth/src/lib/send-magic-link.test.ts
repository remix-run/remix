import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { RequestContext } from '@remix-run/fetch-router'

import type { EmailAuthAttempt } from './email-auth.ts'
import { createMagicLinkAuthProvider } from './providers/magic-link.ts'
import type { MagicLinkMessage } from './providers/magic-link.ts'
import { sendMagicLink } from './send-magic-link.ts'
import { createMemoryEmailAuthStorage } from './test-utils.ts'
import { verifyMagicLink } from './verify-magic-link.ts'

function createContext(url = 'https://app.example.com/login/email'): RequestContext {
  return new RequestContext(new Request(url, { method: 'POST' }))
}

function getToken(message: MagicLinkMessage): string {
  return new URL(message.url).searchParams.get('token')!
}

describe('sendMagicLink()', () => {
  it('passes a single-use link for the normalized address to sendEmail()', async (t) => {
    t.mock.method(Date, 'now', () => 0)
    let messages: MagicLinkMessage[] = []
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: 'https://app.example.com/login/email/verify?source=email',
      sendEmail(message) {
        messages.push(message)
      },
    })

    let result = await sendMagicLink(provider, createContext(), { email: '  MJ@Example.com ' })

    assert.deepEqual(result, {
      status: 'success',
      email: 'mj@example.com',
      expiresAt: new Date(15 * 60 * 1000),
    })
    assert.equal(messages.length, 1)
    assert.equal(messages[0].email, 'mj@example.com')
    assert.deepEqual(messages[0].expiresAt, new Date(15 * 60 * 1000))

    let url = new URL(messages[0].url)
    assert.equal(url.origin, 'https://app.example.com')
    assert.equal(url.pathname, '/login/email/verify')
    assert.equal(url.searchParams.get('source'), 'email')
    assert.match(getToken(messages[0]), /^[A-Za-z0-9_-]{43}$/)
  })

  it('stores a hash of the token instead of the token', async () => {
    let storage = createMemoryEmailAuthStorage()
    let messages: MagicLinkMessage[] = []
    let provider = createMagicLinkAuthProvider({
      storage,
      verifyUrl: 'https://app.example.com/login/email/verify',
      sendEmail(message) {
        messages.push(message)
      },
    })

    await sendMagicLink(provider, createContext(), { email: 'mj@example.com' })

    let token = getToken(messages[0])
    let stored = [...storage.values].flatMap(([key, entry]) => [key, entry.value]).join('\n')

    assert.equal(stored.includes(token), false)
  })

  it('returns invalid_email without sending for malformed addresses', async (t) => {
    let sendEmail = t.mock.fn()
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: 'https://app.example.com/login/email/verify',
      sendEmail,
    })

    let results = [
      await sendMagicLink(provider, createContext(), { email: 'not-an-email' }),
      await sendMagicLink(provider, createContext(), { email: 'mj@example.com\r\nBcc: x@y.com' }),
      await sendMagicLink(provider, createContext(), { email: 'mj@example.com,x@y.com' }),
      await sendMagicLink(provider, createContext(), { email: '' }),
    ]

    assert.deepEqual(results, [
      { status: 'failure', code: 'invalid_email' },
      { status: 'failure', code: 'invalid_email' },
      { status: 'failure', code: 'invalid_email' },
      { status: 'failure', code: 'invalid_email' },
    ])
    assert.equal(sendEmail.mock.calls.length, 0)
  })

  it('rejects addresses that mail servers could route or decode differently', async (t) => {
    let sendEmail = t.mock.fn()
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: 'https://app.example.com/login/email/verify',
      sendEmail,
    })

    let addresses = [
      '=?utf-8?q?attacker=40evil.com=3e=00?=@corp.example',
      'attacker%evil.com@corp.example',
      'attacker!evil.com@corp.example',
      '"attacker@evil.com"@corp.example',
      'attacker\u0085@corp.example',
      'attacker\u202e@corp.example',
      'm\u00fcller@corp.example',
      'mj@localhost',
      `${'a'.repeat(65)}@example.com`,
    ]
    let results = []
    for (let email of addresses) {
      results.push(await sendMagicLink(provider, createContext(), { email }))
    }

    assert.deepEqual(
      results.map((result) => (result.status === 'failure' ? result.code : result.status)),
      addresses.map(() => 'invalid_email'),
    )
    assert.equal(sendEmail.mock.calls.length, 0)
  })

  it('accepts common address forms', async () => {
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: 'https://app.example.com/login/email/verify',
      sendEmail() {},
    })

    let results = [
      await sendMagicLink(provider, createContext(), { email: "o'brien+remix@mail.example.co.uk" }),
      await sendMagicLink(provider, createContext(), { email: 'first.last@xn--bcher-kva.example' }),
    ]

    assert.deepEqual(
      results.map((result) => result.status),
      ['success', 'success'],
    )
  })

  it('rejects resends until the resend interval has passed', async (t) => {
    let now = 0
    t.mock.method(Date, 'now', () => now)
    let sendEmail = t.mock.fn()
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: 'https://app.example.com/login/email/verify',
      resendInterval: 30,
      sendEmail,
    })

    await sendMagicLink(provider, createContext(), { email: 'mj@example.com' })
    now = 29_999
    let throttled = await sendMagicLink(provider, createContext(), { email: 'MJ@example.com' })
    now = 30_000
    let resent = await sendMagicLink(provider, createContext(), { email: 'mj@example.com' })

    assert.deepEqual(throttled, {
      status: 'failure',
      code: 'rate_limited',
      retryAfter: new Date(30_000),
    })
    assert.equal(resent.status, 'success')
    assert.equal(sendEmail.mock.calls.length, 2)
  })

  it('sends at most one link when resend requests race', async (t) => {
    let sendEmail = t.mock.fn()
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: 'https://app.example.com/login/email/verify',
      sendEmail,
    })

    let results = await Promise.all(
      Array.from({ length: 10 }, () =>
        sendMagicLink(provider, createContext(), { email: 'mj@example.com' }),
      ),
    )

    assert.equal(results.filter((result) => result.status === 'success').length, 1)
    assert.equal(sendEmail.mock.calls.length, 1)
  })

  it('replaces the earlier link when a new link is sent', async () => {
    let messages: MagicLinkMessage[] = []
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: 'https://app.example.com/login/email/verify',
      resendInterval: 0,
      sendEmail(message) {
        messages.push(message)
      },
    })

    await sendMagicLink(provider, createContext(), { email: 'mj@example.com' })
    await sendMagicLink(provider, createContext(), { email: 'mj@example.com' })

    let firstResult = await verifyMagicLink(provider, createContext(messages[0].url))
    let secondResult = await verifyMagicLink(provider, createContext(messages[1].url))

    assert.deepEqual(firstResult, { status: 'failure', code: 'invalid_token' })
    assert.equal(secondResult.status, 'success')
  })

  it('returns rate_limited when checkRateLimit() rejects the request', async (t) => {
    let sendEmail = t.mock.fn()
    let attempts: EmailAuthAttempt[] = []
    let context = createContext()
    let rateLimitContexts: unknown[] = []
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: 'https://app.example.com/login/email/verify',
      sendEmail,
      checkRateLimit(attempt, rateLimitContext) {
        attempts.push(attempt)
        rateLimitContexts.push(rateLimitContext)
        return false
      },
    })

    let result = await sendMagicLink(provider, context, { email: 'MJ@example.com' })

    assert.deepEqual(result, { status: 'failure', code: 'rate_limited' })
    assert.deepEqual(attempts, [
      { provider: 'magic-link', action: 'send', email: 'mj@example.com' },
    ])
    assert.equal(rateLimitContexts[0], context)
    assert.equal(sendEmail.mock.calls.length, 0)
  })

  it('revokes the link and rethrows when sendEmail() fails', async () => {
    let messages: MagicLinkMessage[] = []
    let failDelivery = true
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: 'https://app.example.com/login/email/verify',
      sendEmail(message) {
        messages.push(message)
        if (failDelivery) {
          throw new Error('Mail service unavailable')
        }
      },
    })

    await assert.rejects(
      sendMagicLink(provider, createContext(), { email: 'mj@example.com' }),
      new Error('Mail service unavailable'),
    )

    failDelivery = false
    let retry = await sendMagicLink(provider, createContext(), { email: 'mj@example.com' })
    let failedLinkResult = await verifyMagicLink(provider, createContext(messages[0].url))

    assert.equal(retry.status, 'success')
    assert.deepEqual(failedLinkResult, { status: 'failure', code: 'invalid_token' })
  })

  it('keeps the earlier link working when sending a replacement fails', async () => {
    let messages: MagicLinkMessage[] = []
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: 'https://app.example.com/login/email/verify',
      resendInterval: 0,
      sendEmail(message) {
        messages.push(message)
        if (messages.length === 2) {
          throw new Error('Mail service unavailable')
        }
      },
    })

    await sendMagicLink(provider, createContext(), { email: 'mj@example.com' })
    await assert.rejects(
      sendMagicLink(provider, createContext(), { email: 'mj@example.com' }),
      new Error('Mail service unavailable'),
    )

    let earlierResult = await verifyMagicLink(provider, createContext(messages[0].url))
    let failedResult = await verifyMagicLink(provider, createContext(messages[1].url))

    assert.equal(earlierResult.status, 'success')
    assert.deepEqual(failedResult, { status: 'failure', code: 'invalid_token' })
  })

  it('stores only local returnTo paths with the link', async () => {
    let messages: MagicLinkMessage[] = []
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: 'https://app.example.com/login/email/verify',
      sendEmail(message) {
        messages.push(message)
      },
    })

    await sendMagicLink(provider, createContext(), {
      email: 'local@example.com',
      returnTo: '/account/../dashboard?tab=profile',
    })
    await sendMagicLink(provider, createContext(), {
      email: 'remote@example.com',
      returnTo: 'https://evil.example/phish',
    })

    let localResult = await verifyMagicLink(provider, createContext(messages[0].url))
    let remoteResult = await verifyMagicLink(provider, createContext(messages[1].url))

    assert.deepEqual(localResult, {
      status: 'success',
      provider: 'magic-link',
      email: 'local@example.com',
      returnTo: '/dashboard?tab=profile',
    })
    assert.deepEqual(remoteResult, {
      status: 'success',
      provider: 'magic-link',
      email: 'remote@example.com',
      returnTo: undefined,
    })
  })
})
