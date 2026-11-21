import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createMemoryEmailAuthStorage } from '../test-utils.ts'
import { createMagicLinkAuthProvider } from './magic-link.ts'

describe('createMagicLinkAuthProvider()', () => {
  it('uses magic-link as the default provider name', () => {
    let provider = createMagicLinkAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      verifyUrl: new URL('https://app.example.com/login/email/verify'),
      sendEmail() {},
    })

    assert.equal(provider.name, 'magic-link')
  })

  it('requires an absolute http or https verifyUrl', () => {
    assert.throws(
      () =>
        createMagicLinkAuthProvider({
          storage: createMemoryEmailAuthStorage(),
          verifyUrl: '/login/email/verify',
          sendEmail() {},
        }),
      new Error('Expected "verifyUrl" for "magic-link" to be an absolute URL.'),
    )
    assert.throws(
      () =>
        createMagicLinkAuthProvider({
          storage: createMemoryEmailAuthStorage(),
          verifyUrl: 'javascript:alert(1)',
          sendEmail() {},
        }),
      new Error('Expected "verifyUrl" for "magic-link" to be an http: or https: URL.'),
    )
  })

  it('validates expiry and resend settings', () => {
    assert.throws(
      () =>
        createMagicLinkAuthProvider({
          storage: createMemoryEmailAuthStorage(),
          verifyUrl: 'https://app.example.com/login/email/verify',
          expiresIn: 0,
          sendEmail() {},
        }),
      new Error('Expected "expiresIn" for "magic-link" to be a positive number of seconds.'),
    )
    assert.throws(
      () =>
        createMagicLinkAuthProvider({
          storage: createMemoryEmailAuthStorage(),
          verifyUrl: 'https://app.example.com/login/email/verify',
          resendInterval: -1,
          sendEmail() {},
        }),
      new Error(
        'Expected "resendInterval" for "magic-link" to be a non-negative number of seconds.',
      ),
    )
  })

  it('requires storage and sendEmail()', () => {
    assert.throws(
      () =>
        createMagicLinkAuthProvider({
          verifyUrl: 'https://app.example.com/login/email/verify',
          sendEmail() {},
        } as never),
      new Error('Missing storage for the "magic-link" email auth provider.'),
    )
    assert.throws(
      () =>
        createMagicLinkAuthProvider({
          storage: createMemoryEmailAuthStorage(),
          verifyUrl: 'https://app.example.com/login/email/verify',
        } as never),
      new Error('Missing sendEmail() for the "magic-link" email auth provider.'),
    )
  })
})
