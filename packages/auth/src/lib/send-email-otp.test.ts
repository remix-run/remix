import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { RequestContext } from '@remix-run/fetch-router'

import type { EmailAuthAttempt } from './email-auth.ts'
import { createEmailOTPAuthProvider } from './providers/email-otp.ts'
import type { EmailOTPMessage } from './providers/email-otp.ts'
import { sendEmailOTP } from './send-email-otp.ts'
import { createMemoryEmailAuthStorage } from './test-utils.ts'
import { verifyEmailOTP } from './verify-email-otp.ts'

function createContext(): RequestContext {
  return new RequestContext(
    new Request('https://app.example.com/login/code', {
      method: 'POST',
    }),
  )
}

describe('sendEmailOTP()', () => {
  it('passes a numeric code for the normalized address to sendEmail()', async (t) => {
    t.mock.method(Date, 'now', () => 0)
    let messages: EmailOTPMessage[] = []
    let provider = createEmailOTPAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      secret: 'otp-secret',
      sendEmail(message) {
        messages.push(message)
      },
    })

    let result = await sendEmailOTP(provider, createContext(), { email: ' MJ@Example.com' })

    assert.deepEqual(result, {
      status: 'success',
      email: 'mj@example.com',
      expiresAt: new Date(10 * 60 * 1000),
    })
    assert.equal(messages.length, 1)
    assert.equal(messages[0].email, 'mj@example.com')
    assert.match(messages[0].code, /^\d{6}$/)
    assert.deepEqual(messages[0].expiresAt, new Date(10 * 60 * 1000))
  })

  it('uses the configured code length', async () => {
    let messages: EmailOTPMessage[] = []
    let provider = createEmailOTPAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      secret: 'otp-secret',
      codeLength: 8,
      sendEmail(message) {
        messages.push(message)
      },
    })

    await sendEmailOTP(provider, createContext(), { email: 'mj@example.com' })

    assert.match(messages[0].code, /^\d{8}$/)
  })

  it('stores an HMAC of the code instead of the code', async () => {
    let storage = createMemoryEmailAuthStorage()
    let messages: EmailOTPMessage[] = []
    let provider = createEmailOTPAuthProvider({
      storage,
      secret: 'otp-secret',
      codeLength: 12,
      sendEmail(message) {
        messages.push(message)
      },
    })

    await sendEmailOTP(provider, createContext(), { email: 'mj@example.com' })

    let stored = [...storage.values].flatMap(([key, entry]) => [key, entry.value]).join('\n')

    assert.equal(stored.includes(messages[0].code), false)
  })

  it('returns invalid_email without sending for malformed addresses', async (t) => {
    let sendEmail = t.mock.fn()
    let provider = createEmailOTPAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      secret: 'otp-secret',
      sendEmail,
    })

    let result = await sendEmailOTP(provider, createContext(), { email: 'mj@exa mple.com' })
    let missingResult = await sendEmailOTP(provider, createContext(), { email: '@example.com' })

    assert.deepEqual(result, { status: 'failure', code: 'invalid_email' })
    assert.deepEqual(missingResult, { status: 'failure', code: 'invalid_email' })
    assert.equal(sendEmail.mock.calls.length, 0)
  })

  it('rejects resends until the resend interval has passed', async (t) => {
    let now = 0
    t.mock.method(Date, 'now', () => now)
    let sendEmail = t.mock.fn()
    let provider = createEmailOTPAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      secret: 'otp-secret',
      sendEmail,
    })

    await sendEmailOTP(provider, createContext(), { email: 'mj@example.com' })
    now = 59_999
    let throttled = await sendEmailOTP(provider, createContext(), { email: 'mj@example.com' })
    now = 60_000
    let resent = await sendEmailOTP(provider, createContext(), { email: 'mj@example.com' })

    assert.deepEqual(throttled, {
      status: 'failure',
      code: 'rate_limited',
      retryAfter: new Date(60_000),
    })
    assert.equal(resent.status, 'success')
    assert.equal(sendEmail.mock.calls.length, 2)
  })

  it('sends at most one code when resend requests race', async (t) => {
    let sendEmail = t.mock.fn()
    let provider = createEmailOTPAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      secret: 'otp-secret',
      sendEmail,
    })

    let results = await Promise.all(
      Array.from({ length: 10 }, () =>
        sendEmailOTP(provider, createContext(), { email: 'mj@example.com' }),
      ),
    )

    assert.equal(results.filter((result) => result.status === 'success').length, 1)
    assert.equal(sendEmail.mock.calls.length, 1)
  })

  it('keeps the earlier code working when sending a replacement fails', async () => {
    let messages: EmailOTPMessage[] = []
    let provider = createEmailOTPAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      secret: 'otp-secret',
      resendInterval: 0,
      sendEmail(message) {
        messages.push(message)
        if (messages.length === 2) {
          throw new Error('Mail service unavailable')
        }
      },
    })

    await sendEmailOTP(provider, createContext(), { email: 'mj@example.com' })
    await assert.rejects(
      sendEmailOTP(provider, createContext(), { email: 'mj@example.com' }),
      new Error('Mail service unavailable'),
    )

    let result = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code: messages[0].code,
    })

    assert.equal(result.status, 'success')
  })

  it('replaces the earlier code and resets the attempt count when a new code is sent', async () => {
    let messages: EmailOTPMessage[] = []
    let provider = createEmailOTPAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      secret: 'otp-secret',
      maxAttempts: 2,
      resendInterval: 0,
      sendEmail(message) {
        messages.push(message)
      },
    })

    await sendEmailOTP(provider, createContext(), { email: 'mj@example.com' })
    await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code: getWrongCode(messages[0].code),
    })
    await sendEmailOTP(provider, createContext(), { email: 'mj@example.com' })

    let replacedResult = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code: messages[0].code,
    })
    let currentResult = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code: messages[1].code,
    })

    assert.deepEqual(replacedResult, {
      status: 'failure',
      code: 'invalid_code',
      attemptsRemaining: 1,
    })
    assert.equal(currentResult.status, 'success')
  })

  it('returns rate_limited when checkRateLimit() rejects the request', async (t) => {
    let sendEmail = t.mock.fn()
    let attempts: EmailAuthAttempt[] = []
    let provider = createEmailOTPAuthProvider({
      name: 'login-code',
      storage: createMemoryEmailAuthStorage(),
      secret: 'otp-secret',
      sendEmail,
      checkRateLimit(attempt) {
        attempts.push(attempt)
        return false
      },
    })

    let result = await sendEmailOTP(provider, createContext(), { email: 'mj@example.com' })

    assert.deepEqual(result, { status: 'failure', code: 'rate_limited' })
    assert.deepEqual(attempts, [
      { provider: 'login-code', action: 'send', email: 'mj@example.com' },
    ])
    assert.equal(sendEmail.mock.calls.length, 0)
  })

  it('revokes the code and rethrows when sendEmail() fails', async () => {
    let messages: EmailOTPMessage[] = []
    let failDelivery = true
    let provider = createEmailOTPAuthProvider({
      storage: createMemoryEmailAuthStorage(),
      secret: 'otp-secret',
      sendEmail(message) {
        messages.push(message)
        if (failDelivery) {
          throw new Error('Mail service unavailable')
        }
      },
    })

    await assert.rejects(
      sendEmailOTP(provider, createContext(), { email: 'mj@example.com' }),
      new Error('Mail service unavailable'),
    )

    let failedCodeResult = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code: messages[0].code,
    })
    failDelivery = false
    let retry = await sendEmailOTP(provider, createContext(), { email: 'mj@example.com' })

    assert.deepEqual(failedCodeResult, { status: 'failure', code: 'invalid_code' })
    assert.equal(retry.status, 'success')
  })
})

function getWrongCode(code: string): string {
  return code.replace(/^\d/, (digit) => String((Number(digit) + 1) % 10))
}
