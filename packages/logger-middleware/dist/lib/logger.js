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
const ansi = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
};
function getColorizer(option) {
    let enabled = shouldUseColors(option);
    return {
        contentLength(value, bytes) {
            if (!enabled || bytes === undefined)
                return value;
            if (bytes >= 1024 * 1024)
                return colorize(value, ansi.red);
            if (bytes >= 100 * 1024)
                return colorize(value, ansi.yellow);
            if (bytes >= 1024)
                return colorize(value, ansi.cyan);
            return value;
        },
        duration(ms) {
            let value = String(ms);
            if (!enabled)
                return value;
            if (ms >= 1000)
                return colorize(value, ansi.red);
            if (ms >= 500)
                return colorize(value, ansi.magenta);
            if (ms >= 100)
                return colorize(value, ansi.yellow);
            return colorize(value, ansi.green);
        },
        method(method) {
            if (!enabled)
                return method;
            switch (method.toUpperCase()) {
                case 'GET':
                case 'HEAD':
                    return colorize(method, ansi.green);
                case 'POST':
                    return colorize(method, ansi.cyan);
                case 'PUT':
                case 'PATCH':
                    return colorize(method, ansi.yellow);
                case 'DELETE':
                    return colorize(method, ansi.red);
                case 'OPTIONS':
                    return colorize(method, ansi.magenta);
                default:
                    return method;
            }
        },
        status(status) {
            let value = String(status);
            if (!enabled)
                return value;
            if (status >= 500)
                return colorize(value, ansi.red);
            if (status >= 400)
                return colorize(value, ansi.yellow);
            if (status >= 300)
                return colorize(value, ansi.cyan);
            if (status >= 200)
                return colorize(value, ansi.green);
            return value;
        },
    };
}
function shouldUseColors(option) {
    if (typeof process !== 'undefined' && process.env?.NO_COLOR != null) {
        return false;
    }
    if (option !== undefined) {
        return option;
    }
    return typeof process !== 'undefined' && process.stdout?.isTTY === true;
}
function colorize(value, color) {
    return `${color}${value}${ansi.reset}`;
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
