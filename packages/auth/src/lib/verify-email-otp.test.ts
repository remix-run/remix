import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { RequestContext } from '@remix-run/fetch-router'

import type { EmailAuthAttempt } from './email-auth.ts'
import { createEmailOTPAuthProvider } from './providers/email-otp.ts'
import type { EmailOTPAuthProviderOptions, EmailOTPMessage } from './providers/email-otp.ts'
import { sendEmailOTP } from './send-email-otp.ts'
import { createMemoryEmailAuthStorage } from './test-utils.ts'
import { verifyEmailOTP } from './verify-email-otp.ts'

function createContext(): RequestContext {
  return new RequestContext(
    new Request('https://app.example.com/login/code/verify', {
      method: 'POST',
    }),
  )
}

async function sendCode(
  options: Partial<EmailOTPAuthProviderOptions> = {},
  email = 'mj@example.com',
) {
  let messages: EmailOTPMessage[] = []
  let provider = createEmailOTPAuthProvider({
    storage: createMemoryEmailAuthStorage(),
    secret: 'otp-secret',
    ...options,
    sendEmail(message) {
      messages.push(message)
    },
  })

  await sendEmailOTP(provider, createContext(), { email })

  return { provider, code: messages[0].code }
}

function getWrongCode(code: string): string {
  return code.replace(/^\d/, (digit) => String((Number(digit) + 1) % 10))
}

describe('verifyEmailOTP()', () => {
  it('verifies a valid code and returns the email', async () => {
    let { provider, code } = await sendCode()

    let result = await verifyEmailOTP(provider, createContext(), { email: 'mj@example.com', code })

    assert.deepEqual(result, {
      status: 'success',
      provider: 'email-otp',
      email: 'mj@example.com',
    })
  })

  it('ignores address case and spaces or hyphens in the submitted code', async () => {
    let { provider, code } = await sendCode()

    let result = await verifyEmailOTP(provider, createContext(), {
      email: 'MJ@Example.com ',
      code: ` ${code.slice(0, 3)}-${code.slice(3)} `,
    })

    assert.equal(result.status, 'success')
  })

  it('rejects a code that was already used', async () => {
    let { provider, code } = await sendCode()

    await verifyEmailOTP(provider, createContext(), { email: 'mj@example.com', code })
    let result = await verifyEmailOTP(provider, createContext(), { email: 'mj@example.com', code })

    assert.deepEqual(result, { status: 'failure', code: 'invalid_code' })
  })

  it('rejects an expired code', async (t) => {
    let now = 0
    t.mock.method(Date, 'now', () => now)
    let { provider, code } = await sendCode()

    now = 10 * 60 * 1000
    let result = await verifyEmailOTP(provider, createContext(), { email: 'mj@example.com', code })

    assert.deepEqual(result, { status: 'failure', code: 'expired_code' })
  })

  it('reports the remaining attempts after a wrong code', async () => {
    let { provider, code } = await sendCode({ maxAttempts: 3 })
    let wrongCode = getWrongCode(code)

    let firstResult = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code: wrongCode,
    })
    let secondResult = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code: wrongCode,
    })
    let validResult = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code,
    })

    assert.deepEqual(firstResult, {
      status: 'failure',
      code: 'invalid_code',
      attemptsRemaining: 2,
    })
    assert.deepEqual(secondResult, {
      status: 'failure',
      code: 'invalid_code',
      attemptsRemaining: 1,
    })
    assert.equal(validResult.status, 'success')
  })

  it('locks the code after too many wrong attempts', async () => {
    let { provider, code } = await sendCode({ maxAttempts: 2 })
    let wrongCode = getWrongCode(code)

    await verifyEmailOTP(provider, createContext(), { email: 'mj@example.com', code: wrongCode })
    let lockedResult = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code: wrongCode,
    })
    let validResult = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code,
    })

    assert.deepEqual(lockedResult, { status: 'failure', code: 'too_many_attempts' })
    assert.deepEqual(validResult, { status: 'failure', code: 'too_many_attempts' })
  })

  it('does not count malformed codes as attempts', async () => {
    let { provider, code } = await sendCode({ maxAttempts: 1 })

    let results = [
      await verifyEmailOTP(provider, createContext(), { email: 'mj@example.com', code: 'abcdef' }),
      await verifyEmailOTP(provider, createContext(), { email: 'mj@example.com', code: '123' }),
      await verifyEmailOTP(provider, createContext(), { email: 'mj@example.com', code }),
    ]

    assert.deepEqual(results, [
      { status: 'failure', code: 'invalid_code' },
      { status: 'failure', code: 'invalid_code' },
      { status: 'success', provider: 'email-otp', email: 'mj@example.com' },
    ])
  })

  it('rejects a code sent to a different address', async () => {
    let { provider, code } = await sendCode()

    let result = await verifyEmailOTP(provider, createContext(), {
      email: 'someone-else@example.com',
      code,
    })

    assert.deepEqual(result, { status: 'failure', code: 'invalid_code' })
  })

  it('redeems a code at most once when requests race', async () => {
    let { provider, code } = await sendCode()

    let results = await Promise.all(
      Array.from({ length: 5 }, () =>
        verifyEmailOTP(provider, createContext(), { email: 'mj@example.com', code }),
      ),
    )

    assert.equal(results.filter((result) => result.status === 'success').length, 1)
  })

  it('checks at most maxAttempts wrong codes when requests race', async () => {
    let { provider, code } = await sendCode({ maxAttempts: 3 })
    let wrongCode = getWrongCode(code)
    let results = []

    for (let wave = 0; wave < 5; wave++) {
      results.push(
        ...(await Promise.all(
          Array.from({ length: 5 }, () =>
            verifyEmailOTP(provider, createContext(), {
              email: 'mj@example.com',
              code: wrongCode,
            }),
          ),
        )),
      )
    }

    let validResult = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code,
    })

    assert.deepEqual(
      results.flatMap((result) =>
        result.status === 'failure' && result.attemptsRemaining != null
          ? [result.attemptsRemaining]
          : [],
      ),
      [2, 1],
    )
    assert.deepEqual(validResult, { status: 'failure', code: 'too_many_attempts' })
  })

  it('returns rate_limited without using an attempt when checkRateLimit() rejects', async () => {
    let attempts: EmailAuthAttempt[] = []
    let allow = false
    let { provider, code } = await sendCode({
      maxAttempts: 1,
      checkRateLimit(attempt) {
        attempts.push(attempt)
        return attempt.action === 'send' || allow
      },
    })

    let limitedResult = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code: getWrongCode(code),
    })
    allow = true
    let validResult = await verifyEmailOTP(provider, createContext(), {
      email: 'mj@example.com',
      code,
    })

    assert.deepEqual(limitedResult, { status: 'failure', code: 'rate_limited' })
    assert.equal(validResult.status, 'success')
    assert.deepEqual(attempts, [
      { provider: 'email-otp', action: 'send', email: 'mj@example.com' },
      { provider: 'email-otp', action: 'verify', email: 'mj@example.com' },
      { provider: 'email-otp', action: 'verify', email: 'mj@example.com' },
    ])
  })

  it('rejects codes when the provider secret changes', async () => {
    let storage = createMemoryEmailAuthStorage()
    let { code } = await sendCode({ storage })
    let rotatedProvider = createEmailOTPAuthProvider({
      storage,
      secret: 'rotated-secret',
      sendEmail() {},
    })

    let result = await verifyEmailOTP(rotatedProvider, createContext(), {
      email: 'mj@example.com',
      code,
    })

    assert.deepEqual(result, { status: 'failure', code: 'invalid_code', attemptsRemaining: 2 })
  })
})
