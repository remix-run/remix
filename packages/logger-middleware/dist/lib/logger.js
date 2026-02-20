/**
 * Creates a middleware handler that logs various request/response info.
 *
 * @param options Options for the logger
 * @returns The logger middleware
 */
export function logger(options = {}) {
    let { format = '[%date] %method %path %status %contentLength', log = console.log } = options;
    return async ({ request, url }, next) => {
        let start = new Date();
        let response = await next();
        let end = new Date();
        let tokens = {
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
        };
        let message = format.replace(/%(\w+)/g, (_, key) => tokens[key]?.() ?? '-');
        log(message);
        return response;
    };
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
