import {
  Cookie as CookieHeader,
  SetCookie as SetCookieHeader,
  type CookieProperties,
} from '@remix-run/headers'

import { sign, unsign } from './cookie-signing.ts'

/**
 * A container for metadata about a HTTP cookie; its name and secrets that may be used
 * to sign/unsign the value of the cookie to ensure it's not tampered with.
 */
export interface Cookie {
  /**
   * The name of the cookie.
   */
  readonly name: string
  /**
   * True if this cookie uses one or more secrets for verification.
   */
  readonly signed: boolean
  /**
   * Extracts the value of this cookie from a `Cookie` header value.
   * @param headerValue The value of the `Cookie` header to parse
   * @returns The value of this cookie, or `null` if it's not present
   */
  parse(headerValue: string | null): Promise<string | null>
  /**
   * Returns the value to use in a `Set-Cookie` header for this cookie.
   * @param value The value to serialize
   * @param props (optional) Additional properties to use when serializing the cookie
   * @returns The `Set-Cookie` header value for this cookie
   */
  serialize(value: string, props?: CookieProperties): Promise<string>
}

export interface CookieOptions extends CookieProperties {
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
 * Creates a new cookie object.
 * @param name The name of the cookie
 * @param options (optional) Additional options for the cookie
 * @returns A cookie object
 */
export function createCookie(name: string, options?: CookieOptions): Cookie {
  let {
    decode = decodeURIComponent,
    encode = encodeURIComponent,
    secrets = [],
    ...propsFromOptions
  } = options ?? {}

  return {
    get name() {
      return name
    },
    get signed() {
      return secrets.length > 0
    },
    async parse(headerValue: string | null): Promise<string | null> {
      if (!headerValue) return null

      let header = new CookieHeader(headerValue)
      if (!header.has(name)) return null

      let value = header.get(name)!
      if (value === '') return ''

      let decoded = await decodeCookieValue(value, secrets, decode)
      return decoded
    },
    async serialize(value: string, props?: CookieProperties): Promise<string> {
      let header = new SetCookieHeader({
        name: name,
        value: value === '' ? '' : await encodeCookieValue(value, secrets, encode),
        // sane defaults
        path: '/',
        sameSite: 'Lax',
        ...propsFromOptions,
        ...props,
      })

      return header.toString()
    },
  }
}

type Coder = (value: string) => string

async function decodeCookieValue(
  value: string,
  secrets: string[],
  decode: Coder,
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

function decodeValue(value: string, decode: Coder): string | null {
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

async function encodeCookieValue(value: string, secrets: string[], encode: Coder): Promise<string> {
  let encoded = encodeValue(value, encode)

  if (secrets.length > 0) {
    encoded = await sign(encoded, secrets[0])
  }

  return encoded
}

function encodeValue(value: string, encode: Coder): string {
  return btoa(myUnescape(encode(value)))
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
