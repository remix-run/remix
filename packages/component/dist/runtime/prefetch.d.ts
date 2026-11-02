/** Options for prefetching frame content. */
export interface PrefetchOptions {
    /** Name of the destination frame, sent as `X-Remix-Target` by the default strategy. */
    target?: string;
}
/**
 * Starts loading same-origin frame content so a later navigation can reuse the response.
 *
 * @param src Absolute URL of the page to prefetch, without a hash.
 * @param options Destination frame for the request.
 */
export type PrefetchFrame = (src: string, options?: PrefetchOptions) => void;
/**
 * Prefetches frame content so a later navigation can reuse the response. By default this
 * fetches HTML and discovers external JavaScript, CSS, and explicit image and font preloads for
 * `<link rel="prefetch">` hints.
 * Responses use the browser HTTP cache; even uncacheable HTML can reveal cacheable assets. Pass
 * `prefetch` to `run()` to change this behavior. Cross-origin URLs, the current untargeted page, and
 * browsers where Remix doesn't handle navigations are skipped.
 *
 * @param href URL to prefetch, resolved against the document base URL.
 * @param options Destination frame for the request.
 */
export declare function prefetch(href: string, options?: PrefetchOptions): void;
/**
 * Prefetches marked links on mouse/keyboard intent or when they enter the viewport.
 *
 * @param signal Abort signal used to remove the listeners.
 * @param prefetchOverride Replaces how pages are prefetched while the listeners are active.
 */
export declare function startPrefetching(signal: AbortSignal, prefetchOverride?: PrefetchFrame): void;
export declare function createDefaultPrefetch(signal?: AbortSignal): (src: string, options?: PrefetchOptions) => Promise<void>;
