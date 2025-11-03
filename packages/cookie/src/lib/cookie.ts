import type { CookieParseOptions, CookieSerializeOptions } from 'cookie-es'
import { parse, serialize } from 'cookie-es'

import { sign, unsign } from './crypto.ts'
import { warnOnce } from './warnings.ts'

export type { CookieParseOptions, CookieSerializeOptions }

export type CookieOptions = CookieParseOptions &
  CookieSerializeOptions & {
    /**
     * An array of secrets that may be used to sign/unsign the value of a cookie.
     *
     * The array makes it easy to rotate secrets. New secrets should be added to
     * the beginning of the array. `cookie.serialize()` will always use the first
     * value in the array, but `cookie.parse()` may use any of them so that
     * cookies that were signed with older secrets still work.
     */
    secrets?: string[]
  }

/**
 * A HTTP cookie.
 *
 * A Cookie is a logical container for metadata about a HTTP cookie; its name
 * and options. But it doesn't contain a value. Instead, it has `parse()` and
 * `serialize()` methods that allow a single instance to be reused for
 * parsing/encoding multiple different values.
 */
export class Cookie {
  readonly name: string
  readonly #secrets: string[]
  readonly #options: CookieSerializeOptions & CookieParseOptions

  /**
   * Creates a logical container for managing a browser cookie from the server.
   */
  constructor(name: string, cookieOptions: CookieOptions = {}) {
    let { secrets = [], ...options } = {
      path: '/',
      sameSite: 'lax' as const,
      ...cookieOptions,
    }

    warnOnceAboutExpiresCookie(name, options.expires)

    this.name = name
    this.#secrets = secrets
    this.#options = options
  }

  /**
   * True if this cookie uses one or more secrets for verification.
   */
  get isSigned(): boolean {
    return this.#secrets.length > 0
  }

  /**
   * The Date this cookie expires.
   *
   * Note: This is calculated at access time using `maxAge` when no `expires`
   * option is provided to the constructor.
   */
  get expires(): Date | undefined {
    // Max-Age takes precedence over Expires
    return typeof this.#options.maxAge !== 'undefined'
      ? new Date(Date.now() + this.#options.maxAge * 1000)
      : this.#options.expires
  }

  /**
   * Parses a raw `Cookie` header and returns the value of this cookie or
   * `null` if it's not present.
   */
  async parse(
    cookieHeader: string | null,
    parseOptions?: CookieParseOptions,
  ): Promise<string | null> {
    if (!cookieHeader) return null
    let cookies = parse(cookieHeader, { ...this.#options, ...parseOptions })
    if (this.name in cookies) {
      let value = cookies[this.name]
      if (typeof value === 'string' && value !== '') {
        let decoded = await decodeCookieValue(value, this.#secrets)
        return decoded
      } else {
        return ''
      }
    } else {
      return null
    }
  }

  /**
   * Serializes the given value to a string and returns the `Set-Cookie`
   * header.
   */
  async serialize(value: string, serializeOptions?: CookieSerializeOptions): Promise<string> {
    return serialize(this.name, value === '' ? '' : await encodeCookieValue(value, this.#secrets), {
      ...this.#options,
      ...serializeOptions,
    })
  }
}

async function encodeCookieValue(value: string, secrets: string[]): Promise<string> {
  let encoded = encodeData(value)

  if (secrets.length > 0) {
    encoded = await sign(encoded, secrets[0])
  }

  return encoded
}

async function decodeCookieValue(value: string, secrets: string[]): Promise<string | null> {
  if (secrets.length > 0) {
    for (let secret of secrets) {
      let unsignedValue = await unsign(value, secret)
      if (unsignedValue !== false) {
        return decodeData(unsignedValue)
      }
    }

    return null
  }

  return decodeData(value)
}

function encodeData(value: string): string {
  return btoa(myUnescape(encodeURIComponent(value)))
}

function decodeData(value: string): string | null {
  try {
    return decodeURIComponent(myEscape(atob(value)))
  } catch {
    return null
  }
}

// See: https://github.com/zloirock/core-js/blob/master/packages/core-js/modules/es.escape.js
function myEscape(value: string): string {
  let str = value.toString()
  let result = ''
  let index = 0
  let chr, code
  while (index < str.length) {
    chr = str.charAt(index++)
    if (/[\w*+\-./@]/.exec(chr)) {
      result += chr
    } else {
      code = chr.charCodeAt(0)
      if (code < 256) {
        result += '%' + hex(code, 2)
      } else {
        result += '%u' + hex(code, 4).toUpperCase()
      }
    }
  }
  return result
}

function hex(code: number, length: number): string {
  let result = code.toString(16)
  while (result.length < length) result = '0' + result
  return result
}

// See: https://github.com/zloirock/core-js/blob/master/packages/core-js/modules/es.unescape.js
function myUnescape(value: string): string {
  let str = value.toString()
  let result = ''
  let index = 0
  let chr, part
  while (index < str.length) {
    chr = str.charAt(index++)
    if (chr === '%') {
      if (str.charAt(index) === 'u') {
        part = str.slice(index + 1, index + 5)
        if (/^[\da-f]{4}$/i.exec(part)) {
          result += String.fromCharCode(parseInt(part, 16))
          index += 5
          continue
        }
      } else {
        part = str.slice(index, index + 2)
        if (/^[\da-f]{2}$/i.exec(part)) {
          result += String.fromCharCode(parseInt(part, 16))
          index += 2
          continue
        }
      }
    }
    result += chr
  }
  return result
}

function warnOnceAboutExpiresCookie(name: string, expires?: Date) {
  warnOnce(
    !expires,
    `The "${name}" cookie has an "expires" property set. ` +
      `This will cause the expires value to not be updated when the session is committed. ` +
      `Instead, you should set the expires value when serializing the cookie. ` +
      `You can use \`commitSession(session, { expires })\` if using a session storage object, ` +
      `or \`cookie.serialize("value", { expires })\` if you're using the cookie directly.`,
  )
}
