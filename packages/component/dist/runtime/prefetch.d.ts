/**
 * Starts loading a same-origin page so a later top-frame navigation to it can reuse the response.
 *
 * @param src Absolute URL of the page to prefetch, without a hash.
 */
export type PrefetchFrame = (src: string) => void;
/**
 * Prefetches a page so a later top-frame navigation to it can reuse the response. By default this
 * adds a `<link rel="prefetch">`, which only helps when the response is HTTP-cacheable. Pass
 * `prefetch` to `run()` to change how pages are prefetched. Cross-origin URLs, the current page, and
 * browsers where Remix doesn't handle navigations are skipped.
 *
 * @param href URL to prefetch, resolved against the document base URL.
 */
export declare function prefetch(href: string): void;
/**
 * Prefetches links marked `data-rmx-prefetch="intent"` when the visitor rests on one with the
 * mouse or keyboard focus, or presses it.
 *
 * @param signal Abort signal used to remove the listeners.
 * @param prefetchOverride Replaces how pages are prefetched while the listeners are active.
 */
export declare function startPrefetching(signal: AbortSignal, prefetchOverride?: PrefetchFrame): void;
