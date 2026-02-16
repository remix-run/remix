import type { Middleware } from '@remix-run/fetch-router';
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
    format?: string;
    /**
     * The function to use to log messages.
     *
     * @default console.log
     */
    log?: (message: string) => void;
}
/**
 * Creates a middleware handler that logs various request/response info.
 *
 * @param options Options for the logger
 * @returns The logger middleware
 */
export declare function logger(options?: LoggerOptions): Middleware;
//# sourceMappingURL=logger.d.ts.map