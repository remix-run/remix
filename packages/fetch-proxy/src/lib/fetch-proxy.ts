import { SetCookie } from '@mjackson/headers';

export interface FetchProxyOptions {
  /**
   * The `fetch` function to use for the actual fetch. Defaults to the global `fetch` function.
   */
  fetch?: typeof globalThis.fetch;
  /**
   * Set `false` to prevent the `Domain` attribute of `Set-Cookie` headers from being rewritten. By
   * default the domain will be rewritten to the domain of the incoming request.
   */
  rewriteCookieDomain?: boolean;
  /**
   * Set `false` to prevent the `Path` attribute of `Set-Cookie` headers from being rewritten. By
   * default the portion of the pathname that matches the proxy target's pathname will be removed.
   */
  rewriteCookiePath?: boolean;
  /**
   * Set `true` to add `X-Forwarded-Proto` and `X-Forwarded-Host` headers to the proxied request.
   * Defaults to `false`.
   */
  xForwardedHeaders?: boolean;
}

/**
 * A [`fetch` function](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch)
 * that forwards requests to another server.
 */
export interface FetchProxy {
  (input: URL | RequestInfo, init?: RequestInit): Promise<Response>;
}

/**
 * Creates a `fetch` function that forwards requests to another server.
 * @param target The URL of the server to proxy requests to
 * @param options Options to customize the behavior of the proxy
 * @returns A fetch function that forwards requests to the target server
 */
export function createFetchProxy(target: string | URL, options?: FetchProxyOptions): FetchProxy {
  let localFetch = options?.fetch ?? globalThis.fetch;
  let rewriteCookieDomain = options?.rewriteCookieDomain ?? true;
  let rewriteCookiePath = options?.rewriteCookiePath ?? true;
  let xForwardedHeaders = options?.xForwardedHeaders ?? false;

  let targetUrl = new URL(target);
  if (targetUrl.pathname.endsWith('/')) {
    targetUrl.pathname = targetUrl.pathname.replace(/\/+$/, '');
  }

  return async (input: URL | RequestInfo, init?: RequestInit) => {
    let incomingRequest = new Request(input, init);
    let incomingUrl = new URL(incomingRequest.url);

    let proxyUrl = new URL(incomingUrl.search, targetUrl);
    if (incomingUrl.pathname !== '/') {
      proxyUrl.pathname =
        proxyUrl.pathname === '/' ? incomingUrl.pathname : proxyUrl.pathname + incomingUrl.pathname;
    }

    let proxyHeaders = new Headers(incomingRequest.headers);
    if (xForwardedHeaders) {
      proxyHeaders.append('X-Forwarded-Proto', incomingUrl.protocol.replace(/:$/, ''));
      proxyHeaders.append('X-Forwarded-Host', incomingUrl.host);
    }

    let proxyInit: RequestInit = {
      method: incomingRequest.method,
      headers: proxyHeaders,
    };
    if (incomingRequest.method !== 'GET' && incomingRequest.method !== 'HEAD') {
      proxyInit.body = incomingRequest.body;

      // init.duplex = 'half' must be set when body is a ReadableStream, and Node follows the spec.
      // However, this property is not defined in the TypeScript types for RequestInit, so we have
      // to cast it here in order to set it without a type error.
      // See https://fetch.spec.whatwg.org/#dom-requestinit-duplex
      (proxyInit as { duplex: 'half' }).duplex = 'half';
    }

    let targetResponse = await localFetch(proxyUrl, proxyInit);
    let responseHeaders = new Headers(targetResponse.headers);

    if (responseHeaders.has('Set-Cookie')) {
      let setCookie = responseHeaders.getSetCookie();

      responseHeaders.delete('Set-Cookie');

      for (let cookie of setCookie) {
        let header = new SetCookie(cookie);

        if (rewriteCookieDomain && header.domain) {
          header.domain = incomingUrl.host;
        }

        if (rewriteCookiePath && header.path) {
          if (header.path.startsWith(targetUrl.pathname + '/')) {
            header.path = header.path.slice(targetUrl.pathname.length);
          } else if (header.path === targetUrl.pathname) {
            header.path = '/';
          }
        }

        responseHeaders.append('Set-Cookie', header.toString());
      }
    }

    return new Response(targetResponse.body, {
      status: targetResponse.status,
      statusText: targetResponse.statusText,
      headers: responseHeaders,
    });
  };
}
