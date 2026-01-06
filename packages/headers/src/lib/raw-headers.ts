import { canonicalHeaderName } from './header-names.ts'

const CRLF = '\r\n'

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
      headers.append(match[1].trim(), match[2].trim())
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
