import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { RequestContext } from '@remix-run/fetch-router'

import { createMagicLinkAuthProvider } from './providers/magic-link.ts'
import type { MagicLinkMessage } from './providers/magic-link.ts'
import { sendMagicLink } from './send-magic-link.ts'
import { createMemoryEmailAuthStorage } from './test-utils.ts'
import { verifyMagicLink } from './verify-magic-link.ts'

function createContext(url: string, init?: RequestInit): RequestContext {
  return new RequestContext(new Request(url, init))
}

async function sendLink(email = 'mj@example.com') {
  let storage = createMemoryEmailAuthStorage()
  let messages: MagicLinkMessage[] = []
  let provider = createMagicLinkAuthProvider({
    storage,
    verifyUrl: 'https://app.example.com/login/email/verify',
    sendEmail(message) {
      messages.push(message)
    },
  })

  await sendMagicLink(provider, createContext('https://app.example.com/login/email'), {
    email,
    returnTo: '/dashboard',
  })

  return { provider, storage, url: messages[0].url }
}

describe('verifyMagicLink()', () => {
  it('verifies a valid link and returns the email and returnTo path', async () => {
    let { provider, url } = await sendLink()

    let result = await verifyMagicLink(provider, createContext(url, { method: 'POST' }))

    assert.deepEqual(result, {
      status: 'success',
      provider: 'magic-link',
      email: 'mj@example.com',
      returnTo: '/dashboard',
    })
  })

  it('rejects a link that was already used', async () => {
    let { provider, url } = await sendLink()

    await verifyMagicLink(provider, createContext(url, { method: 'POST' }))
    let result = await verifyMagicLink(provider, createContext(url, { method: 'POST' }))

    assert.deepEqual(result, { status: 'failure', code: 'invalid_token' })
  })

  it('rejects an expired link', async (t) => {
    let now = 0
    t.mock.method(Date, 'now', () => now)
    let { provider, url } = await sendLink()

    now = 15 * 60 * 1000
    let result = await verifyMagicLink(provider, createContext(url, { method: 'POST' }))

    assert.deepEqual(result, { status: 'failure', code: 'expired_token' })
  })

  it('rejects missing, malformed, and unknown tokens', async () => {
    let { provider } = await sendLink()

    let results = [
      await verifyMagicLink(provider, createContext('https://app.example.com/login/email/verify')),
      await verifyMagicLink(
        provider,
        createContext('https://app.example.com/login/email/verify?token=short'),
      ),
      await verifyMagicLink(
        provider,
        createContext(`https://app.example.com/login/email/verify?token=${'a'.repeat(43)}`),
      ),
    ]

    assert.deepEqual(results, [
      { status: 'failure', code: 'invalid_token' },
      { status: 'failure', code: 'invalid_token' },
      { status: 'failure', code: 'invalid_token' },
    ])
  })

  it('redeems a link at most once when requests race', async () => {
    let { provider, url } = await sendLink()

    let results = await Promise.all(
      Array.from({ length: 5 }, () =>
        verifyMagicLink(provider, createContext(url, { method: 'POST' })),
      ),
    )

    assert.equal(results.filter((result) => result.status === 'success').length, 1)
    assert.equal(
      results.filter((result) => result.status === 'failure' && result.code === 'invalid_token')
        .length,
      4,
    )
  })

  it('verifies a token passed in options instead of the request URL', async () => {
    let { provider, url } = await sendLink()
    let token = new URL(url).searchParams.get('token')

    let result = await verifyMagicLink(
      provider,
      createContext('https://app.example.com/login/email/verify', { method: 'POST' }),
      { token },
    )

    assert.equal(result.status, 'success')
  })

  it('rejects links issued by a different provider sharing the same storage', async () => {
    let { storage, url } = await sendLink()
    let otherProvider = createMagicLinkAuthProvider({
      name: 'admin-magic-link',
      storage,
      verifyUrl: 'https://app.example.com/admin/login/verify',
      sendEmail() {},
    })

    let result = await verifyMagicLink(otherProvider, createContext(url, { method: 'POST' }))

    assert.deepEqual(result, { status: 'failure', code: 'invalid_token' })
  })

  it('rejects objects that were not created by createMagicLinkAuthProvider()', async () => {
    await assert.rejects(
      verifyMagicLink(
        { name: 'fake' } as never,
        createContext('https://app.example.com/login/email/verify'),
      ),
      new Error('Invalid magic link provider "fake".'),
    )
  })
})
