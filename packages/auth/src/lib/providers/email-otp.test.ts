import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createMemoryEmailAuthStorage } from '../test-utils.ts'
import { createEmailOTPAuthProvider } from './email-otp.ts'

describe('createEmailOTPAuthProvider()', () => {
  it('uses email-otp as the default provider name', () => {
    let provider = createEmailOTPAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      secret: 'otp-secret',
      sendEmail() {},
    })

    assert.equal(provider.name, 'email-otp')
  })

  it('requires a secret', () => {
    assert.throws(
      () =>
        createEmailOTPAuthProvider({
          storage: createMemoryEmailAuthStorage(),
          secret: '',
          sendEmail() {},
        }),
      new Error('Missing secret for the "email-otp" email auth provider.'),
    )
  })

  it('accepts code lengths from 6 to 12 digits', () => {
    assert.throws(
      () =>
        createEmailOTPAuthProvider({
          storage: createMemoryEmailAuthStorage(),
          secret: 'otp-secret',
          codeLength: 4,
          sendEmail() {},
        }),
      new Error('Expected "codeLength" for "email-otp" to be an integer from 6 to 12.'),
    )
    assert.throws(
      () =>
        createEmailOTPAuthProvider({
          storage: createMemoryEmailAuthStorage(),
          secret: 'otp-secret',
          codeLength: 6.5,
          sendEmail() {},
        }),
      new Error('Expected "codeLength" for "email-otp" to be an integer from 6 to 12.'),
    )
  })

  it('requires a positive integer maxAttempts', () => {
    assert.throws(
      () =>
        createEmailOTPAuthProvider({
          storage: createMemoryEmailAuthStorage(),
          secret: 'otp-secret',
          maxAttempts: 0,
          sendEmail() {},
        }),
      new Error('Expected "maxAttempts" for "email-otp" to be a positive integer.'),
    )
  })

  it('requires sendEmail()', () => {
    assert.throws(
      () =>
        createEmailOTPAuthProvider({
          storage: createMemoryEmailAuthStorage(),
          secret: 'otp-secret',
        } as never),
      new Error('Missing sendEmail() for the "email-otp" email auth provider.'),
    )
  })
})
