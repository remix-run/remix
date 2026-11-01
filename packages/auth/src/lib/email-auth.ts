import type { RequestContext } from '@remix-run/fetch-router'

import { toBase64Url } from './utils.ts'

/**
 * Persistent key-value storage for pending magic links and email OTP codes.
 *
 * Values are opaque strings owned by `remix/auth`. Tokens and codes are hashed before they reach
 * storage. Use a database or cache shared by every server instance.
 */
export interface EmailAuthStorage {
  /**
   * Reads the value stored for a key.
   *
   * @param key The storage key
   * @returns The stored value, or `null` when nothing is stored for the key
   */
  get(key: string): Promise<string | null>
  /**
   * Stores a value for a key, replacing any existing value.
   *
   * @param key The storage key
   * @param value The value to store
   * @param expiresAt Time after which the value is no longer needed and may be deleted
   * @returns A promise that resolves once the value is stored
   */
  set(key: string, value: string, expiresAt: Date): Promise<void>
  /**
   * Stores a value only when no unexpired value is stored for the key, in one atomic operation.
   * When concurrent calls race for the same key, at most one of them may store its value.
   *
   * @param key The storage key
   * @param value The value to store
   * @param expiresAt Time after which the value no longer blocks another `add()` and may be deleted
   * @returns `true` when the value was stored, or `false` when an unexpired value already exists
   */
  add(key: string, value: string, expiresAt: Date): Promise<boolean>
  /**
   * Deletes and returns the value stored for a key in one atomic operation. When concurrent calls
   * race for the same key, at most one of them may receive the value.
   *
   * @param key The storage key
   * @returns The value that was stored, or `null` when nothing is stored for the key
   */
  take(key: string): Promise<string | null>
}

/**
 * Email sign-in attempt passed to an application's `checkRateLimit()` hook.
 */
export interface EmailAuthAttempt<provider extends string = string> {
  /** Name of the provider handling the attempt. */
  provider: provider
  /** `send` before a credential is issued, or `verify` before a submitted code is checked. */
  action: 'send' | 'verify'
  /** Normalized email address the attempt targets. */
  email: string
}

/**
 * Result returned when a credential is issued and passed to the provider's `sendEmail()` hook.
 */
export interface EmailAuthSendSuccess {
  /** Marks the credential as issued. */
  status: 'success'
  /** Normalized email address the credential was issued for. */
  email: string
  /** Time when the credential stops working. */
  expiresAt: Date
}

/**
 * Result returned when no credential is issued.
 */
export interface EmailAuthSendFailure {
  /** Marks the request as rejected. */
  status: 'failure'
  /**
   * `invalid_email` when the address is malformed, or `rate_limited` when the resend interval or
   * the application's `checkRateLimit()` hook rejected the request.
   */
  code: 'invalid_email' | 'rate_limited'
  /** Earliest time another credential can be requested, when known. */
  retryAfter?: Date
}

/**
 * Result returned by `sendMagicLink()` and `sendEmailOTP()`.
 */
export type EmailAuthSendResult = EmailAuthSendSuccess | EmailAuthSendFailure

export type EmailAuthRateLimitHook<provider extends string> = (
  attempt: EmailAuthAttempt<provider>,
  context: RequestContext,
) => boolean | Promise<boolean>

export interface EmailAuthConfig<provider extends string = string> {
  name: provider
  storage: EmailAuthStorage
  expiresIn: number
  resendInterval: number
  checkRateLimit?: EmailAuthRateLimitHook<provider>
}

export interface EmailAuthConfigOptions<provider extends string> {
  storage: EmailAuthStorage
  expiresIn?: number
  resendInterval?: number
  checkRateLimit?: EmailAuthRateLimitHook<provider>
}

export interface EmailCredential {
  id: string
  value: string
  deliver(): void | Promise<void>
}

const textEncoder = new TextEncoder()
const maxEmailLength = 254
const maxLocalPartLength = 64
// Accept a conservative ASCII subset. Characters such as `%`, `!`, `=?`, quotes, and non-ASCII
// text can be routed or decoded by mail servers as a different address than the one verified.
const emailPattern =
  /^[a-z0-9_'+-]+(?:\.[a-z0-9_'+-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/

export function createEmailAuthConfig<provider extends string>(
  name: provider,
  options: EmailAuthConfigOptions<provider>,
  defaultExpiresIn: number,
): EmailAuthConfig<provider> {
  if (options.storage == null) {
    throw new Error(`Missing storage for the "${name}" email auth provider.`)
  }

  let expiresIn = options.expiresIn ?? defaultExpiresIn
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error(`Expected "expiresIn" for "${name}" to be a positive number of seconds.`)
  }

  let resendInterval = options.resendInterval ?? 60
  if (!Number.isFinite(resendInterval) || resendInterval < 0) {
    throw new Error(
      `Expected "resendInterval" for "${name}" to be a non-negative number of seconds.`,
    )
  }

  return {
    name,
    storage: options.storage,
    expiresIn: expiresIn * 1000,
    resendInterval: resendInterval * 1000,
    checkRateLimit: options.checkRateLimit,
  }
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  let email = value.trim().toLowerCase()
  if (
    email.length > maxEmailLength ||
    email.indexOf('@') > maxLocalPartLength ||
    !emailPattern.test(email)
  ) {
    return null
  }

  return email
}

export async function isRateLimited<provider extends string>(
  config: EmailAuthConfig<provider>,
  context: RequestContext,
  action: EmailAuthAttempt['action'],
  email: string,
): Promise<boolean> {
  if (config.checkRateLimit == null) {
    return false
  }

  let allowed = await config.checkRateLimit({ provider: config.name, action, email }, context)
  return !allowed
}

export async function sendEmailCredential<provider extends string>(
  config: EmailAuthConfig<provider>,
  context: RequestContext,
  input: string,
  kind: string,
  createCredential: (email: string, expiresAt: Date) => Promise<EmailCredential>,
): Promise<EmailAuthSendResult> {
  let email = normalizeEmail(input)
  if (email == null) {
    return { status: 'failure', code: 'invalid_email' }
  }

  if (await isRateLimited(config, context, 'send', email)) {
    return { status: 'failure', code: 'rate_limited' }
  }

  let now = Date.now()
  let resendKey = `${config.name}:resend:${email}`
  let resendAt = new Date(now + config.resendInterval)

  if (
    config.resendInterval > 0 &&
    !(await config.storage.add(resendKey, String(resendAt.getTime()), resendAt))
  ) {
    let storedResendAt = Number(await config.storage.get(resendKey))
    return {
      status: 'failure',
      code: 'rate_limited',
      retryAfter:
        Number.isFinite(storedResendAt) && storedResendAt > 0
          ? new Date(storedResendAt)
          : undefined,
    }
  }

  let expiresAt = new Date(now + config.expiresIn)
  let credential = await createCredential(email, expiresAt)
  let credentialKey = getCredentialKey(config, kind, credential.id)

  await config.storage.set(credentialKey, credential.value, expiresAt)

  try {
    await credential.deliver()
  } catch (error) {
    // The earlier credential stays live, and releasing the resend slot lets the person retry now.
    await Promise.all([config.storage.take(credentialKey), config.storage.take(resendKey)]).catch(
      () => {},
    )
    throw error
  }

  let previous = await readEmailPointer(config, email)
  await config.storage.set(
    getEmailPointerKey(config, email),
    JSON.stringify({ id: credential.id }),
    expiresAt,
  )

  if (previous != null && previous.id !== credential.id) {
    await config.storage.take(getCredentialKey(config, kind, previous.id))
  }

  return { status: 'success', email, expiresAt }
}

export async function readEmailPointer<provider extends string>(
  config: EmailAuthConfig<provider>,
  email: string,
): Promise<{ id: string } | null> {
  let data = parseStoredObject(await config.storage.get(getEmailPointerKey(config, email)))
  if (data == null || typeof data.id !== 'string') {
    return null
  }

  return { id: data.id }
}

export function getCredentialKey<provider extends string>(
  config: EmailAuthConfig<provider>,
  kind: string,
  id: string,
): string {
  return `${config.name}:${kind}:${id}`
}

export function parseStoredObject(value: string | null): Record<string, unknown> | null {
  if (value == null) {
    return null
  }

  let data: unknown
  try {
    data = JSON.parse(value)
  } catch {
    return null
  }

  if (typeof data !== 'object' || data == null || Array.isArray(data)) {
    return null
  }

  return data as Record<string, unknown>
}

export async function sha256(value: string): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  return toBase64Url(new Uint8Array(digest))
}

export function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

export async function hmacSha256(key: CryptoKey, value: string): Promise<string> {
  let signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(value))
  return toBase64Url(new Uint8Array(signature))
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let difference = 0
  for (let index = 0; index < a.length; index++) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return difference === 0
}

export function createNumericCode(length: number): string {
  let code = ''
  let bytes = new Uint8Array(length * 2)

  while (code.length < length) {
    crypto.getRandomValues(bytes)

    for (let byte of bytes) {
      // Bytes from 250 to 255 would make digits 0-5 more likely than 6-9.
      if (byte >= 250) {
        continue
      }

      code += String(byte % 10)
      if (code.length === length) {
        break
      }
    }
  }

  return code
}

function getEmailPointerKey<provider extends string>(
  config: EmailAuthConfig<provider>,
  email: string,
): string {
  return `${config.name}:email:${email}`
}
