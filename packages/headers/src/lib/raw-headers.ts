import { canonicalHeaderName } from './header-names.ts'

const CRLF = '\r\n'

/**
 * Encodes non-ASCII characters in a string using percent-encoding.
 * This is needed because the native Headers class only accepts ISO-8859-1 characters.
 */
function encodeNonAscii(value: string): string {
  let encoder = new TextEncoder()

  return Array.from(value).reduce((result, char) => {
    let code = char.charCodeAt(0)

    if (code > 127) {
      return encoder.encode(char).reduce(
        (acc, byte) => acc + '%' + byte.toString(16).toUpperCase().padStart(2, '0'),
        result
      )
    }

    return result + char
  }, '')
}

/**
 * Parses a raw HTTP header string into a `Headers` object.
 *
 * @param raw A raw HTTP header string with headers separated by CRLF (`\r\n`)
 * @returns A `Headers` object containing the parsed headers
 *
 * @example
 * let headers = parse('Content-Type: text/html\r\nCache-Control: no-cache')
 * headers.get('content-type') // 'text/html'
 * headers.get('cache-control') // 'no-cache'
 */
export function parse(raw: string): Headers {
  let headers = new Headers()

  for (let line of raw.split(CRLF)) {
    let match = line.match(/^([^:]+):(.*)/)
    if (match) {
      let name = match[1].trim()
      let value = match[2].trim()
      try {
        headers.append(name, value)
      } catch (error) {
        // Native Headers throws for non-ISO-8859-1 characters.
        // Different runtimes use different error messages:
        // - Browser: "ISO-8859-1"
        // - Node.js: "ByteString" / "greater than 255"
        // Encode non-ASCII characters so the header can be stored.
        if (
          error instanceof TypeError &&
          (error.message.includes('ISO-8859-1') ||
            error.message.includes('ByteString') ||
            error.message.includes('greater than 255'))
        ) {
          headers.append(name, encodeNonAscii(value))
        } else {
          throw error
        }
      }
    }
  }

  return headers
}

/**
 * Converts a `Headers` object to a raw HTTP header string.
 *
 * @param headers A `Headers` object to stringify
 * @returns A raw HTTP header string with headers separated by CRLF (`\r\n`)
 *
 * @example
 * let headers = new Headers({ 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' })
 * stringify(headers) // 'Content-Type: text/html\r\nCache-Control: no-cache'
 */
export function stringify(headers: Headers): string {
  let result = ''

  for (let [name, value] of headers) {
    if (result) result += CRLF
    result += `${canonicalHeaderName(name)}: ${value}`
  }

  return result
}
