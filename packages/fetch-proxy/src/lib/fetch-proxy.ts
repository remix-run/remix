import { SetCookie } from '@remix-run/headers'

/**
 * Options for `createFetchProxy`.
 */
export interface FetchProxyOptions {
  /**
   * The `fetch` function to use for the actual fetch.
   *
   * @default globalThis.fetch
   */
  fetch?: typeof globalThis.fetch
  /**
   * Set `false` to prevent the `Domain` attribute of `Set-Cookie` headers from being rewritten. By
   * default the domain will be rewritten to the domain of the incoming request.
   *
   * @default true
   */
  rewriteCookieDomain?: boolean
  /**
   * Set `false` to prevent the `Path` attribute of `Set-Cookie` headers from being rewritten. By
   * default the portion of the pathname that matches the proxy target's pathname will be removed.
   *
   * @default true
   */
  rewriteCookiePath?: boolean
  /**
   * Set `true` to add `X-Forwarded-Proto` and `X-Forwarded-Host` headers to the proxied request.
   *
   * @default false
   */
  xForwardedHeaders?: boolean
}

/**
 * A [`fetch` function](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch)
 * that forwards requests to another server.
 *
 * @param input The URL or request to forward
 * @param init Optional request init options
 * @returns A promise that resolves to the proxied response
 */
export interface FetchProxy {
  (input: URL | RequestInfo, init?: RequestInit): Promise<Response>
}

/**
 * Creates a `fetch` function that forwards requests to another server.
 *
 * @param target The URL of the server to proxy requests to
 * @param options Options to customize the behavior of the proxy
 * @returns A fetch function that forwards requests to the target server
 */
export function createFetchProxy(target: string | URL, options?: FetchProxyOptions): FetchProxy {
  let localFetch = options?.fetch ?? globalThis.fetch
  let rewriteCookieDomain = options?.rewriteCookieDomain ?? true
  let rewriteCookiePath = options?.rewriteCookiePath ?? true
  let xForwardedHeaders = options?.xForwardedHeaders ?? false

  let targetUrl = new URL(target)
  if (targetUrl.pathname.endsWith('/')) {
    targetUrl.pathname = targetUrl.pathname.replace(/\/+$/, '')
  }

  return async (input: URL | RequestInfo, init?: RequestInit) => {
    let request = new Request(input, init)
    let url = new URL(request.url)

    let proxyUrl = new URL(url.search, targetUrl)
    if (url.pathname !== '/') {
      proxyUrl.pathname =
        proxyUrl.pathname === '/' ? url.pathname : proxyUrl.pathname + url.pathname
    }

    let proxyHeaders = new Headers(request.headers)
    if (xForwardedHeaders) {
      proxyHeaders.append('X-Forwarded-Proto', url.protocol.replace(/:$/, ''))
      proxyHeaders.append('X-Forwarded-Host', url.host)
    }

    let proxyInit: RequestInit = {
      method: request.method,
      headers: proxyHeaders,
      cache: request.cache,
      credentials: request.credentials,
      integrity: request.integrity,
      keepalive: request.keepalive,
      mode: request.mode,
      redirect: request.redirect,
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy,
      signal: request.signal,
      ...init,
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      proxyInit.body = request.body

      // init.duplex = 'half' must be set when body is a ReadableStream, and Node follows the spec.
      // However, this property is not defined in the TypeScript types for RequestInit, so we have
      // to cast it here in order to set it without a type error.
      // See https://fetch.spec.whatwg.org/#dom-requestinit-duplex
      ;(proxyInit as { duplex: 'half' }).duplex = 'half'
    }

    let response = await localFetch(proxyUrl, proxyInit)
    let responseHeaders = new Headers(response.headers)

    if (responseHeaders.has('Set-Cookie')) {
      let setCookie = responseHeaders.getSetCookie()

      responseHeaders.delete('Set-Cookie')

      for (let cookie of setCookie) {
        let header = new SetCookie(cookie)

        if (rewriteCookieDomain && header.domain) {
          header.domain = url.host
        }

        if (rewriteCookiePath && header.path) {
          if (header.path.startsWith(targetUrl.pathname + '/')) {
            header.path = header.path.slice(targetUrl.pathname.length)
          } else if (header.path === targetUrl.pathname) {
            header.path = '/'
          }
        }

        responseHeaders.append('Set-Cookie', header.toString())
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  }
}
