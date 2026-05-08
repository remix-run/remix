import { createStyles } from '@remix-run/terminal';
/**
 * Creates a middleware handler that logs various request/response info.
 *
 * @param options Options for the logger
 * @returns The logger middleware
 */
export function logger(options = {}) {
    let { colors, format = '[%date] %method %path %status %contentLength', log = console.log, } = options;
    let colorizer = getColorizer(colors);
    return async ({ request, url }, next) => {
        let start = new Date();
        let response = await next();
        let end = new Date();
        let duration = end.getTime() - start.getTime();
        let contentLength = response.headers.get('Content-Length');
        let contentLengthValue = parseContentLength(contentLength);
        let tokens = {
            date: () => formatApacheDate(start),
            dateISO: () => start.toISOString(),
            duration: () => colorizer.duration(duration),
            contentLength: () => colorizer.contentLength(contentLength ?? '-', contentLengthValue),
            contentType: () => response.headers.get('Content-Type') ?? '-',
            host: () => url.host,
            hostname: () => url.hostname,
            method: () => colorizer.method(request.method),
            path: () => url.pathname + url.search,
            pathname: () => url.pathname,
            port: () => url.port,
            protocol: () => url.protocol,
            query: () => url.search,
            referer: () => request.headers.get('Referer') ?? '-',
            search: () => url.search,
            status: () => colorizer.status(response.status),
            statusText: () => response.statusText,
            url: () => url.href,
            userAgent: () => request.headers.get('User-Agent') ?? '-',
        };
        let message = format.replace(/%(\w+)/g, (_, key) => tokens[key]?.() ?? '-');
        log(message);
        return response;
    };
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function getColorizer(option) {
    let styles = createStyles({ colors: option });
    return {
        contentLength(value, bytes) {
            if (!styles.enabled || bytes === undefined)
                return value;
            if (bytes >= 1024 * 1024)
                return styles.red(value);
            if (bytes >= 100 * 1024)
                return styles.yellow(value);
            if (bytes >= 1024)
                return styles.cyan(value);
            return value;
        },
        duration(ms) {
            let value = String(ms);
            if (!styles.enabled)
                return value;
            if (ms >= 1000)
                return styles.red(value);
            if (ms >= 500)
                return styles.magenta(value);
            if (ms >= 100)
                return styles.yellow(value);
            return styles.green(value);
        },
        method(method) {
            if (!styles.enabled)
                return method;
            switch (method.toUpperCase()) {
                case 'GET':
                case 'HEAD':
                    return styles.green(method);
                case 'POST':
                    return styles.cyan(method);
                case 'PUT':
                case 'PATCH':
                    return styles.yellow(method);
                case 'DELETE':
                    return styles.red(method);
                case 'OPTIONS':
                    return styles.magenta(method);
                default:
                    return method;
            }
        },
        status(status) {
            let value = String(status);
            if (!styles.enabled)
                return value;
            if (status >= 500)
                return styles.red(value);
            if (status >= 400)
                return styles.yellow(value);
            if (status >= 300)
                return styles.cyan(value);
            if (status >= 200)
                return styles.green(value);
            return value;
        },
    };
}
function parseContentLength(value) {
    if (value === null)
        return undefined;
    let bytes = Number(value);
    return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : undefined;
}
/**
 * Formats a date in Apache/nginx log format: "dd/Mon/yyyy:HH:mm:ss ±zzzz"
 * Example: "23/Sep/2025:11:34:12 -0700"
 *
 * @param date The date to format
 * @returns The formatted date string
 */
function formatApacheDate(date) {
    let day = String(date.getDate()).padStart(2, '0');
    let month = months[date.getMonth()];
    let year = date.getFullYear();
    let hours = String(date.getHours()).padStart(2, '0');
    let minutes = String(date.getMinutes()).padStart(2, '0');
    let seconds = String(date.getSeconds()).padStart(2, '0');
    // Get timezone offset in minutes and convert to ±HHMM format
    let timezoneOffset = date.getTimezoneOffset();
    let sign = timezoneOffset <= 0 ? '+' : '-';
    let offsetHours = String(Math.floor(Math.abs(timezoneOffset) / 60)).padStart(2, '0');
    let offsetMinutes = String(Math.abs(timezoneOffset) % 60).padStart(2, '0');
    let timezone = `${sign}${offsetHours}${offsetMinutes}`;
    return `${day}/${month}/${year}:${hours}:${minutes}:${seconds} ${timezone}`;
}
