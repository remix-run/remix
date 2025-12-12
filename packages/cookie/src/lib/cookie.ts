import {
  Cookie as CookieHeader,
  SetCookie as SetCookieHeader,
  type CookieProperties,
} from '@remix-run/headers'

import { sign, unsign } from './cookie-signing.ts'

/**
 * Options for creating a cookie.
 */
export interface CookieOptions extends CookieProperties {
  /**
   * A function that decodes the cookie value. Decodes any URL-encoded sequences into their
   * original characters.
   *
   * See [RFC 6265](https://tools.ietf.org/html/rfc6265#section-4.1.1) for more details.
   *
   * @default decodeURIComponent
   */
  decode?: (value: string) => string
  /**
   * A function that encodes the cookie value. Percent-encodes all characters that are not allowed
   * in a cookie value.
   *
   * See [RFC 6265](https://tools.ietf.org/html/rfc6265#section-4.1.1) for more details.
   *
   * @default encodeURIComponent
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

type SameSiteValue = 'Strict' | 'Lax' | 'None'
type Coder = (value: string) => string

/**
 * Represents a HTTP cookie.
 *
 * Supports parsing and serializing the cookie to/from `Cookie` and `Set-Cookie` headers.
 *
 * Also supports cryptographic signing of the cookie value to ensure it's not tampered with, and
 * secret rotation to easily rotate secrets without breaking existing cookies.
 */
export class Cookie implements CookieProperties {
  #name: string
  #decode: Coder
  #encode: Coder
  #secrets: string[]
  #domain: string | undefined
  #expires: Date | undefined
  #httpOnly: boolean | undefined
  #maxAge: number | undefined
  #partitioned: boolean | undefined
  #path: string
  #sameSite: SameSiteValue
  #secure: boolean | undefined

  /**
   * @param name The name of the cookie
   * @param options Options for the cookie
   */
  constructor(name: string, options?: CookieOptions) {
    let {
      decode = decodeURIComponent,
      encode = encodeURIComponent,
      secrets = [],
      domain,
      expires,
      httpOnly,
      maxAge,
      path = '/',
      partitioned,
      secure,
      sameSite = 'Lax',
    } = options ?? {}

    if (partitioned === true) {
      // Partitioned cookies must be set with Secure
      // See https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies
      secure = true
    }

    this.#name = name
    this.#decode = decode
    this.#encode = encode
    this.#secrets = secrets
    this.#domain = domain
    this.#expires = expires
    this.#httpOnly = httpOnly
    this.#maxAge = maxAge
    this.#partitioned = partitioned
    this.#path = path
    this.#sameSite = sameSite
    this.#secure = secure
  }

  /**
   * The domain of the cookie.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/Web/HTTP/Headers/Set-Cookie#domaindomain-value)
   */
  get domain(): string | undefined {
    return this.#domain
  }

  /**
   * The expiration date of the cookie.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/Web/HTTP/Headers/Set-Cookie#expiresdate)
   */
  get expires(): Date | undefined {
    return this.#expires
  }

  /**
   * True if the cookie is HTTP-only.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/Web/HTTP/Headers/Set-Cookie#httponly)
   *
   * @default false
   */
  get httpOnly(): boolean {
    return this.#httpOnly ?? false
  }

  /**
   * The maximum age of the cookie in seconds.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#max-agenumber)
   */
  get maxAge(): number | undefined {
    return this.#maxAge
  }

  /**
   * The name of the cookie.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#cookie-namecookie-value)
   */
  get name(): string {
    return this.#name
  }

  /**
   * Extracts the value of this cookie from a `Cookie` header value.
   *
   * @param headerValue The `Cookie` header to parse
   * @returns The value of this cookie, or `null` if it's not present
   */
  async parse(headerValue: string | null): Promise<string | null> {
    if (!headerValue) return null

    let header = new CookieHeader(headerValue)
    if (!header.has(this.#name)) return null

    let value = header.get(this.#name)!
    if (value === '') return ''

    let decoded = await decodeCookieValue(value, this.#secrets, this.#decode)
    return decoded
  }

  /**
   * True if the cookie is partitioned.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/Web/HTTP/Headers/Set-Cookie#partitioned)
   *
   * @default false
   */
  get partitioned(): boolean {
    return this.#partitioned ?? false
  }

  /**
   * The path of the cookie.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#pathpath-value)
   *
   * @default '/'
   */
  get path(): string {
    return this.#path
  }

  /**
   * The `SameSite` attribute of the cookie.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value)
   *
   * @default 'Lax'
   */
  get sameSite(): SameSiteValue {
    return this.#sameSite
  }

  /**
   * True if the cookie is secure (only sent over HTTPS).
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#secure)
   *
   * @default false
   */
  get secure(): boolean {
    return this.#secure ?? false
  }

  /**
   * Returns the value to use in a `Set-Cookie` header for this cookie.
   *
   * @param value The value to serialize
   * @param props Additional properties to use when serializing the cookie
   * @returns The `Set-Cookie` header value for this cookie
   */
  async serialize(value: string, props?: CookieProperties): Promise<string> {
    let header = new SetCookieHeader({
      name: this.#name,
      value: value === '' ? '' : await encodeCookieValue(value, this.#secrets, this.#encode),
      domain: this.#domain,
      expires: this.#expires,
      httpOnly: this.#httpOnly,
      maxAge: this.#maxAge,
      partitioned: this.#partitioned,
      path: this.#path,
      sameSite: this.#sameSite,
      secure: this.#secure,
      ...props,
    })

    return header.toString()
  }

  /**
   * True if this cookie uses one or more secrets for verification.
   */
  get signed(): boolean {
    return this.#secrets.length > 0
  }
}

/**
 * Creates a new cookie object.
 *
 * @param name The name of the cookie
 * @param options Options for the cookie
 * @returns A new `Cookie` object
 */
export function createCookie(name: string, options?: CookieOptions): Cookie {
  return new Cookie(name, options)
}

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
  if (secrets.length > 0) encoded = await sign(encoded, secrets[0])
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
