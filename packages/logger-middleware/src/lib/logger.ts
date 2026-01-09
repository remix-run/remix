import type { Middleware } from '@remix-run/fetch-router'

/**
 * Options for the `logger` middleware.
 */
export interface LoggerOptions {
  /**
   * The format to use for log messages.
   *
   * The following tokens are available:
   *
   * - `%date` - The date and time of the request in Apache/nginx log format (dd/Mon/yyyy:HH:mm:ss ±zzzz)
   * - `%dateISO` - The date and time of the request in ISO format
   * - `%duration` - The duration of the request in milliseconds
   * - `%contentLength` - The `Content-Length` header of the response
   * - `%contentType` - The `Content-Type` header of the response
   * - `%host` - The host of the request URL
   * - `%hostname` - The hostname of the request URL
   * - `%method` - The method of the request
   * - `%path` - The pathname + search of the request URL
   * - `%pathname` - The pathname of the request URL
   * - `%port` - The port of the request
   * - `%query` - The query (search) string of the request URL
   * - `%referer` - The `Referer` header of the request
   * - `%search` - The search string of the request URL
   * - `%status` - The status code of the response
   * - `%statusText` - The status text of the response
   * - `%url` - The full URL of the request
   * - `%userAgent` - The `User-Agent` header of the request
   *
   * @default '[%date] %method %path %status %contentLength'
   */
  format?: string
  /**
   * The function to use to log messages.
   *
   * @default console.log
   */
  log?: (message: string) => void
}

/**
 * Creates a middleware handler that logs various request/response info.
 *
 * @param options Options for the logger
 * @returns The logger middleware
 */
export function logger(options: LoggerOptions = {}): Middleware {
  let { format = '[%date] %method %path %status %contentLength', log = console.log } = options

  return async ({ request, url }, next) => {
    let start = new Date()
    let response = await next()
    let end = new Date()

    let tokens: Record<string, () => string> = {
      date: () => formatApacheDate(start),
      dateISO: () => start.toISOString(),
      duration: () => String(end.getTime() - start.getTime()),
      contentLength: () => response.headers.get('Content-Length') ?? '-',
      contentType: () => response.headers.get('Content-Type') ?? '-',
      host: () => url.host,
      hostname: () => url.hostname,
      method: () => request.method,
      path: () => url.pathname + url.search,
      pathname: () => url.pathname,
      port: () => url.port,
      protocol: () => url.protocol,
      query: () => url.search,
      referer: () => request.headers.get('Referer') ?? '-',
      search: () => url.search,
      status: () => String(response.status),
      statusText: () => response.statusText,
      url: () => url.href,
      userAgent: () => request.headers.get('User-Agent') ?? '-',
    }

    let message = format.replace(/%(\w+)/g, (_, key) => tokens[key]?.() ?? '-')

    log(message)

    return response
  }
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Formats a date in Apache/nginx log format: "dd/Mon/yyyy:HH:mm:ss ±zzzz"
 * Example: "23/Sep/2025:11:34:12 -0700"
 *
 * @param date The date to format
 * @returns The formatted date string
 */
function formatApacheDate(date: Date): string {
  let day = String(date.getDate()).padStart(2, '0')
  let month = months[date.getMonth()]
  let year = date.getFullYear()
  let hours = String(date.getHours()).padStart(2, '0')
  let minutes = String(date.getMinutes()).padStart(2, '0')
  let seconds = String(date.getSeconds()).padStart(2, '0')

  // Get timezone offset in minutes and convert to ±HHMM format
  let timezoneOffset = date.getTimezoneOffset()
  let sign = timezoneOffset <= 0 ? '+' : '-'
  let offsetHours = String(Math.floor(Math.abs(timezoneOffset) / 60)).padStart(2, '0')
  let offsetMinutes = String(Math.abs(timezoneOffset) % 60).padStart(2, '0')
  let timezone = `${sign}${offsetHours}${offsetMinutes}`

  return `${day}/${month}/${year}:${hours}:${minutes}:${seconds} ${timezone}`
}
