import { SetCookie } from '@remix-run/headers/set-cookie';
// Original hop-by-hop list: https://www.rfc-editor.org/rfc/rfc2616.html#section-13.5.1
// Current forwarding rules, including legacy Proxy-Connection:
// https://www.rfc-editor.org/rfc/rfc9110.html#section-7.6.1
const hopByHopRequestHeaders = [
    'Connection',
    'Keep-Alive',
    'Proxy-Authenticate',
    'Proxy-Authorization',
    'Proxy-Connection',
    'TE',
    'Trailer',
    'Transfer-Encoding',
    'Upgrade',
];
/**
 * Creates a `fetch` function that forwards requests to another server.
 *
 * Removes connection-specific request headers and incoming `Content-Length` so the outgoing
 * fetch can determine framing for the forwarded body.
 *
 * @param target The URL of the server to proxy requests to
 * @param options Options to customize the behavior of the proxy
 * @returns A fetch function that forwards requests to the target server
 */
export function createFetchProxy(target, options) {
    let localFetch = options?.fetch ?? globalThis.fetch;
    let redirect = options?.redirect;
    let rewriteCookieDomain = options?.rewriteCookieDomain ?? true;
    let rewriteCookiePath = options?.rewriteCookiePath ?? true;
    let xForwardedHeaders = options?.xForwardedHeaders ?? false;
    let targetUrl = new URL(target);
    if (targetUrl.pathname.endsWith('/')) {
        targetUrl.pathname = targetUrl.pathname.replace(/\/+$/, '');
    }
    return async (input, init) => {
        let request = new Request(input, init);
        let url = new URL(request.url);
        let proxyUrl = new URL(url.search, targetUrl);
        if (url.pathname !== '/') {
            proxyUrl.pathname =
                proxyUrl.pathname === '/' ? url.pathname : proxyUrl.pathname + url.pathname;
        }
        let proxyHeaders = new Headers(request.headers);
        for (let name of (proxyHeaders.get('Connection') ?? '').split(',')) {
            let headerName = name.trim();
            if (headerName !== '')
                proxyHeaders.delete(headerName);
        }
        for (let name of hopByHopRequestHeaders) {
            proxyHeaders.delete(name);
        }
        proxyHeaders.delete('Host');
        proxyHeaders.delete('Accept-Encoding');
        proxyHeaders.delete('Content-Length');
        if (xForwardedHeaders) {
            proxyHeaders.delete('Forwarded');
            proxyHeaders.delete('X-Forwarded-For');
            proxyHeaders.set('X-Forwarded-Proto', url.protocol.replace(/:$/, ''));
            proxyHeaders.set('X-Forwarded-Host', url.host);
            proxyHeaders.set('X-Forwarded-Port', getForwardedPort(url));
        }
        let proxyInit = {
            method: request.method,
            cache: request.cache,
            credentials: request.credentials,
            integrity: request.integrity,
            keepalive: request.keepalive,
            mode: request.mode,
            referrer: request.referrer,
            referrerPolicy: request.referrerPolicy,
            signal: request.signal,
            ...init,
            redirect: init?.redirect ?? redirect ?? (request.redirect === 'follow' ? 'manual' : request.redirect),
            headers: proxyHeaders,
        };
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            proxyInit.body = request.body;
            proxyInit.duplex = 'half';
        }
        let response = await localFetch(proxyUrl, proxyInit);
        let responseHeaders = new Headers(response.headers);
        let hasContentEncoding = responseHeaders.has('Content-Encoding');
        let hasTransferEncoding = responseHeaders.has('Transfer-Encoding');
        let hasProxiedResponseBody = request.method !== 'HEAD' && response.body != null;
        responseHeaders.delete('Transfer-Encoding');
        if (hasTransferEncoding || (hasProxiedResponseBody && hasContentEncoding)) {
            responseHeaders.delete('Content-Length');
        }
        if (hasProxiedResponseBody && hasContentEncoding) {
            responseHeaders.delete('Content-Encoding');
        }
        if (responseHeaders.has('Set-Cookie')) {
            let setCookie = responseHeaders.getSetCookie();
            responseHeaders.delete('Set-Cookie');
            for (let cookie of setCookie) {
                let header = new SetCookie(cookie);
                if (rewriteCookieDomain && header.domain) {
                    header.domain = getCookieDomain(url.hostname);
                }
                if (rewriteCookiePath && header.path) {
                    if (header.path.startsWith(targetUrl.pathname + '/')) {
                        header.path = header.path.slice(targetUrl.pathname.length);
                    }
                    else if (header.path === targetUrl.pathname) {
                        header.path = '/';
                    }
                }
                responseHeaders.append('Set-Cookie', header.toString());
            }
        }
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    };
}
function getCookieDomain(hostname) {
    if (hostname.toLowerCase() === 'localhost' || isIpAddress(hostname)) {
        return undefined;
    }
    return hostname;
}
function isIpAddress(hostname) {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
}
function getForwardedPort(url) {
    if (url.port !== '') {
        return url.port;
    }
    return url.protocol === 'https:' ? '443' : '80';
}
