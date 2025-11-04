import {
  Cookie as CookieHeader,
  SetCookie as SetCookieHeader,
  type CookieProperties,
} from '@remix-run/headers'

import { sign, unsign } from './crypto.ts'

export interface CookieOptions {
  /**
   * A function that decodes the cookie value.
   *
   * Defaults to `decodeURIComponent`, which decodes any URL-encoded sequences into their original
   * characters.
   *
   * See [RFC 6265](https://tools.ietf.org/html/rfc6265#section-4.1.1) for more details.
   */
  decode?: (value: string) => string
  /**
   * A function that encodes the cookie value.
   *
   * Defaults to `encodeURIComponent`, which percent-encodes all characters that are not allowed
   * in a cookie value.
   *
   * See [RFC 6265](https://tools.ietf.org/html/rfc6265#section-4.1.1) for more details.
   */
  encode?: (value: string) => string
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
 * A container for metadata about a HTTP cookie; its name and secrets that may be used
 * to sign/unsign the value of the cookie to ensure it's not tampered with.
 */
export class Cookie {
  readonly name: string
  readonly #decode?: (value: string) => string
  readonly #encode?: (value: string) => string
  readonly #secrets: string[]

  constructor(name: string, options?: CookieOptions) {
    this.name = name
    this.#decode = options?.decode
    this.#encode = options?.encode
    this.#secrets = options?.secrets ?? []
  }

  /**
   * True if this cookie uses one or more secrets for verification.
   */
  get isSigned(): boolean {
    return this.#secrets.length > 0
  }

  /**
   * Extracts the value of this cookie from a `Cookie` header value.
   * @param headerValue The value of the `Cookie` header to parse
   * @returns The value of this cookie, or `null` if it's not present
   */
  async parse(headerValue: string | null): Promise<string | null> {
    if (!headerValue) return null

    let header = new CookieHeader(headerValue)
    if (!header.has(this.name)) return null

    let value = header.get(this.name)!
    if (value === '') return ''

    let decoded = await decodeCookieValue(value, this.#secrets, this.#decode)
    return decoded
  }

  /**
   * Returns the value to use in a `Set-Cookie` header for this cookie.
   * @param value The value to serialize
   * @param props (optional) Additional properties to use when serializing the cookie
   * @returns The value to use in a `Set-Cookie` header for this cookie
   */
  async serialize(value: string, props?: CookieProperties): Promise<string> {
    let header = new SetCookieHeader({
      name: this.name,
      value: value === '' ? '' : await encodeCookieValue(value, this.#secrets, this.#encode),
      // sane defaults
      path: '/',
      sameSite: 'Lax',
      ...props,
    })

    return header.toString()
  }
}

async function encodeCookieValue(
  value: string,
  secrets: string[],
  encode: (value: string) => string = encodeURIComponent,
): Promise<string> {
  let encoded = encodeValue(value, encode)

  if (secrets.length > 0) {
    encoded = await sign(encoded, secrets[0])
  }

  return encoded
}

function encodeValue(value: string, encode: (value: string) => string): string {
  return btoa(myUnescape(encode(value)))
}

async function decodeCookieValue(
  value: string,
  secrets: string[],
  decode: (value: string) => string = decodeURIComponent,
): Promise<string | null> {
  if (secrets.length > 0) {
    for (let secret of secrets) {
      let unsignedValue = await unsign(value, secret)
      if (unsignedValue !== false) {
        return decodeValue(unsignedValue, decode)
      }
    }

    return null
  }

  return decodeValue(value, decode)
}

function decodeValue(value: string, decode: (value: string) => string): string | null {
  try {
    return decode(myEscape(atob(value)))
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
