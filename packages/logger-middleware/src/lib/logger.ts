import type { Middleware } from '@remix-run/fetch-router'
import { colorizeToken } from './colors.ts'

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
   * - `%durationPretty` - The duration of the request in a human-readable format (e.g., '1.2s', '120ms')
   * - `%contentLength` - The `Content-Length` header of the response
   * - `%contentLengthPretty` - The `Content-Length` header of the response in a human-readable format (e.g., '1.2kB', '120B')
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
   * @default '[%date] %method %path %status $durationPretty %contentLengthPretty'
   */
  format?: string
  /**
   * The function to use to log messages.
   *
   * @default console.log
   */
  log?: (message: string) => void
  /**
   * Enables or disables colorized output for the log messages.
   * When `true`, tokens like `%status`, `%method`, `%durationPretty`, and `%contentLengthPretty`
   * will be color-coded in the output.
   *
   * @default false
   */
  colors?: boolean
}

/**
 * Creates a middleware handler that logs various request/response info.
 *
 * @param options Options for the logger
 * @return The logger middleware
 */
export function logger(options: LoggerOptions = {}): Middleware {
  let {
    format = '[%date] %method %path %status %durationPretty %contentLengthPretty',
    log = console.log,
    colors = false,
  } = options

  return async ({ request, url }, next) => {
    let start = new Date()
    let response = await next()
    let end = new Date()
    let duration = end.getTime() - start.getTime()
    let contentLength = response.headers.get('Content-Length')
    let contentLengthNum = contentLength ? parseInt(contentLength, 10) : undefined

    let tokens: Record<string, () => string> = {
      date: () => formatApacheDate(start),
      dateISO: () => start.toISOString(),
      duration: () => String(duration),
      durationPretty: () => {
        let value = formatDuration(duration)
        return colors ? colorizeToken('durationPretty', value, duration) : value
      },
      contentLength: () => contentLength ?? '-',
      contentLengthPretty: () => {
        let value = contentLength ? formatFileSize(contentLengthNum!) : '-'
        return colors ? colorizeToken('contentLengthPretty', value, contentLengthNum) : value
      },
      contentType: () => response.headers.get('Content-Type') ?? '-',
      host: () => url.host,
      hostname: () => url.hostname,
      method: () => {
        let value = request.method
        return colors ? colorizeToken('method', value) : value
      },
      path: () => url.pathname + url.search,
      pathname: () => url.pathname,
      port: () => url.port,
      protocol: () => url.protocol,
      query: () => url.search,
      referer: () => request.headers.get('Referer') ?? '-',
      search: () => url.search,
      status: () => {
        let value = String(response.status)
        return colors ? colorizeToken('status', value, response.status) : value
      },
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

/**
 * Formats a file size in a human-readable format.
 * Example: 1024 -> "1.0 kB"
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  let units = ['B', 'kB', 'MB', 'GB', 'TB']
  let i = Math.floor(Math.log(bytes) / Math.log(1024))
  let size = bytes / Math.pow(1024, i)
  return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

const MINUTE_IN_MS = 60 * 1000
const HOUR_IN_MS = 60 * MINUTE_IN_MS

/**
 * Formats a duration in a human-readable format.
 * Example: 1200 -> "1.20s"
 */
export function formatDuration(ms: number): string {
  if (ms >= HOUR_IN_MS) {
    return `${(ms / HOUR_IN_MS).toFixed(2)}h`
  }
  if (ms >= MINUTE_IN_MS) {
    return `${(ms / MINUTE_IN_MS).toFixed(2)}m`
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`
  }
  return `${ms}ms`
}
