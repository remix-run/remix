/**
 * Options for `createFetchProxy`.
 */
export interface FetchProxyOptions {
    /**
     * The `fetch` function to use for the actual fetch.
     *
     * @default globalThis.fetch
     */
    fetch?: typeof globalThis.fetch;
    /**
     * Set `false` to prevent the `Domain` attribute of `Set-Cookie` headers from being rewritten. By
     * default the domain will be rewritten to the domain of the incoming request.
     *
     * @default true
     */
    rewriteCookieDomain?: boolean;
    /**
     * Set `false` to prevent the `Path` attribute of `Set-Cookie` headers from being rewritten. By
     * default the portion of the pathname that matches the proxy target's pathname will be removed.
     *
     * @default true
     */
    rewriteCookiePath?: boolean;
    /**
     * Set `true` to add `X-Forwarded-Proto` and `X-Forwarded-Host` headers to the proxied request.
     *
     * @default false
     */
    xForwardedHeaders?: boolean;
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
    (input: URL | RequestInfo, init?: RequestInit): Promise<Response>;
}
/**
 * Creates a `fetch` function that forwards requests to another server.
 *
 * @param target The URL of the server to proxy requests to
 * @param options Options to customize the behavior of the proxy
 * @returns A fetch function that forwards requests to the target server
 */
export declare function createFetchProxy(target: string | URL, options?: FetchProxyOptions): FetchProxy;
//# sourceMappingURL=fetch-proxy.d.ts.map