import type { Middleware } from '../middleware.ts'

export interface LoggerOptions {
  /**
   * The format to use for log messages. Defaults to `[%date] %method %path %status %contentLength`.
   *
   * The following tokens are available:
   *
   * - `%date` - The date and time of the request in Apache/nginx log format (dd/Mon/yyyy:HH:mm:ss ±zzzz).
   * - `%dateISO` - The date and time of the request in ISO format.
   * - `%duration` - The duration of the request in milliseconds.
   * - `%contentLength` - The `Content-Length` header of the response.
   * - `%contentType` - The `Content-Type` header of the response.
   * - `%host` - The host of the request URL.
   * - `%hostname` - The hostname of the request URL.
   * - `%method` - The method of the request.
   * - `%path` - The pathname + search of the request URL.
   * - `%pathname` - The pathname of the request URL.
   * - `%port` - The port of the request.
   * - `%query` - The query (search) string of the request URL.
   * - `%referer` - The `Referer` header of the request.
   * - `%search` - The search string of the request URL.
   * - `%status` - The status code of the response.
   * - `%statusText` - The status text of the response.
   * - `%url` - The full URL of the request.
   * - `%userAgent` - The `User-Agent` header of the request.
   */
  format?: string
  /**
   * The function to use to log messages. Defaults to `console.log`.
   */
  log?: (message: string) => void
}

/**
 * Creates a middleware handler that logs various request/response info.
 */
export function logger(options: LoggerOptions = {}): Middleware {
  let { format = '[%date] %method %path %status %contentLength', log = console.log } = options

  return async ({ request, url }, next) => {
    let start = new Date()
    let response = await next()
    let end = new Date()

    let message = format.replace(/%(\w+)/g, (_, key) => {
      switch (key) {
        case 'date':
          return formatApacheDate(start)
        case 'dateISO':
          return start.toISOString()
        case 'duration':
          return String(end.getTime() - start.getTime())
        case 'contentLength':
          return response.headers.get('Content-Length') || '-'
        case 'contentType':
          return response.headers.get('Content-Type') || '-'
        case 'host':
          return url.host
        case 'hostname':
          return url.hostname
        case 'method':
          return request.method
        case 'path':
          return url.pathname + url.search
        case 'pathname':
          return url.pathname
        case 'port':
          return url.port
        case 'protocol':
          return url.protocol
        case 'query':
          return url.search
        case 'referer':
          return request.headers.get('Referer') || '-'
        case 'search':
          return url.search
        case 'status':
          return String(response.status)
        case 'statusText':
          return response.statusText
        case 'url':
          return url.href
        case 'userAgent':
          return request.headers.get('User-Agent') || '-'
        default:
          return '-'
      }
    })

    log(message)
  }
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Formats a date in Apache/nginx log format: "dd/Mon/yyyy:HH:mm:ss ±zzzz"
 * Example: "23/Sep/2025:11:34:12 -0700"
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
