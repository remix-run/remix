# Discover prefetch assets from HTML and use the browser cache

We chose HTML discovery with asset prefetch tags as the direction for Remix's default frame prefetching. Remix fetches a destination's HTML, parses it without activating the page, and creates prefetch hints for its explicit JavaScript and CSS URLs. Navigation uses the normal frame resolver. The browser owns response caching and revalidation.

This extends the HTML-only prefetching in [PR #12004][base-pr]. We evaluated four strategies in `demos/prefetch`, then promoted HTML discovery into the component runtime. The demo now uses that default and contains no custom prefetch implementation or strategy selector.

## Starting point

The evaluation branch, `brophdawg11/codex-prefetch-assets`, starts from `brookslybrand/link-prefetch-intent` in PR #12004, **Prefetch links on intent with data-rmx-prefetch**, at commit [`4c6a6989b51295501fb0ae2ee44f14a453664af9`][base-commit].

That branch establishes when and which pages Remix prefetches:

- `data-rmx-prefetch="intent"` starts a prefetch after 100ms of mouse or keyboard focus, or immediately on pointer press.
- `prefetch(href)` starts the same work programmatically, such as when a search narrows to one result.
- Only another same-origin URL eligible for an untargeted top-frame navigation is considered. The current page, downloads, document navigations, named-frame links, and links opening another browsing context are excluded. URL fragments are removed.
- Prefetching is opt-in. Marked GET routes must be safe to request speculatively; submissions are not prefetched.
- `run({ prefetch })` lets applications replace the loading strategy while retaining Remix's intent detection and link eligibility rules.

The original default creates an HTML `<link rel="prefetch">`. It does not read the response or discover destination assets. This helps HTML delivery when the response is reusable, but destination client entries and stylesheets can still need network requests after navigation. Our decision changes the loading strategy while retaining those intent and eligibility rules.

## Four approaches we compared

| Strategy                                    | HTML loading                                                             | Asset loading                              | Navigation reuse                                                            | Main tradeoff                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **1. Browser prefetch**                     | HTML `<link rel="prefetch">`                                             | Assets load on navigation                  | Default resolver and browser HTTP cache                                     | Smallest implementation, but no asset discovery                                             |
| **2. Custom HTML + asset preloads**         | Custom GET and inert parsing                                             | `<link rel="preload" as="script\|style">`  | Custom resolver joins pending HTML and consumes a temporary memory fallback | Earlier asset loading and explicit HTML handoff, with more request and cache lifecycle code |
| **3. Custom HTML + asset prefetch tags**    | Same custom GET and parsing as option 2                                  | `<link rel="prefetch" as="script\|style">` | Same custom resolver and memory fallback as option 2                        | Browser schedules speculative assets, but HTML handoff still needs custom machinery         |
| **4. HTML discovery + asset prefetch tags** | Custom GET solely to discover assets; response is consumed and discarded | Same asset hints as option 3               | Default resolver and browser HTTP cache                                     | Warms assets even for uncacheable HTML, while giving up explicit HTML handoff               |

Options 2 and 3 first try to leave cacheable HTML in HTTP storage. A cache-only probe determines whether to discard the userland response. Otherwise, a FIFO cache retains it for one navigation, with a ten-entry limit and a 30-second expiration. Their custom resolver also handles response adoption, cancellation forwarding, invalidation, and delegation on a miss. Reads do not change FIFO order or extend expiration.

Those modes never cache asset bytes in userland. Like option 4, they only track outstanding asset hints; actual asset reuse belongs to the browser.

We chose option 4 because it adds the missing asset discovery without making the default prefetch implementation another response cache or navigation resolver. Option 3 demonstrated that changing asset hints alone does not remove the complexity of HTML handoff. Option 2 remains useful for comparing speculative prefetch hints with preloads intended for resources needed by the current document. The HTML standard distinguishes those purposes.[prefetch-hints]

## How HTML discovery works

The default implementation is `packages/component/src/runtime/default-prefetch.ts`. The existing intent and eligibility code in `prefetch.ts` calls it unless the application supplies an override.

1. Normalize the same-origin URL and make a GET with `priority: 'low'` and the normal frame headers, `Accept: text/html` and `X-Remix-Frame: true`. Use ordinary fetch caching behavior.
2. Read a successful HTML response into a detached `<template>`. Resolve asset URLs against the final response URL after redirects, honoring its first `<base href>`.
3. Find external scripts, stylesheet links, module preload links, and script/style preload links. Recursively inspect nested template contents, including assets carried in streamed frame templates.
4. Skip matching assets already active in the current document and deduplicate pending asset hints. Create new script/style **prefetch** links, preserving the relevant CORS, integrity, and referrer attributes.
5. Keep hints connected while they load, including across a frame navigation. Remove each hint on load or error. The runtime tracks its own pending head links and excludes them from document head reconciliation so navigation does not cancel unfinished work. Runtime disposal cancels speculative HTML requests and removes pending hints.
6. Discard the consumed HTML. On navigation, use the default resolver, which performs its normal request and lets the browser decide whether to reuse, validate, or fetch a response.

A map of pending discovery work prevents overlapping prefetch calls from starting identical work in userland. Its entries disappear when that work finishes. It contains no completed response cache, has no expiration policy, and is never consulted by navigation. Failures remain speculative and do not replace or block the normal navigation path.

## Inert parsing and import maps

We need the destination's asset URLs without mounting its DOM or booting its application. A detached template provides queryable contents without activating the parsed scripts, import maps, or styles.[templates] The discovery code creates fresh resource hints; it never inserts the parsed destination nodes into the active document.

We considered loading the destination in a hidden iframe so the browser could discover resources using that document's import map. A normal iframe also runs the destination application. Preventing that reliably would require a separate execution policy or server response mode, so we rejected it for this default.

We also avoid copying destination `modulepreload` links into the current document as module preloads. Module preloading can fetch a dependency graph using the current document's module environment.[modulepreload] That is the wrong environment when the destination has a different import map. Instead, we read the explicit URL attributes and warm their bytes with ordinary asset prefetch hints. The destination's import map and module graph are handled during actual navigation.

This deliberately stops at explicit URLs. It does not resolve bare imports, traverse JavaScript dependencies, parse CSS `@import`, or discover CSS images and fonts. Assets that need warming must appear in the HTML's resource declarations.

## Browser caching remains authoritative

HTML does not need a particular cache policy for **asset discovery**: our fetch can read even a `no-store` response. Reusing that HTML on navigation is a separate matter, governed by the server's policy:

| HTML cache policy     | Navigation behavior                                                    |
| --------------------- | ---------------------------------------------------------------------- |
| `private, max-age=30` | The browser may reuse a matching fresh response                        |
| `no-cache`            | Storage is allowed, but reuse requires validation                      |
| `no-store`            | The response cannot be stored for reuse; navigation fetches HTML again |

These are HTTP cache rules, not Remix freshness rules.[http-cache] Assets have their own independent response policies. Fingerprinted assets with long freshness can remain useful even when their containing HTML cannot be cached.

An HTML prefetch link does not give us a portable five-minute reuse window when the response has no explicit freshness lifetime. Chrome removed its special five-minute rule in version 133 and now applies normal HTTP cache semantics to link prefetches.[chrome-prefetch-cache] We therefore rely on the server's cache policy for both HTML fetches and asset hints, rather than choosing HTML links for an assumed cache lifetime.

Reuse also requires a matching cache entry, including request variants selected by `Vary`. Using the normal frame headers avoids the original HTML link strategy's inability to send `X-Remix-Frame`. It does not override variant matching, credentials, cache partitioning, eviction, or browser resource policies.

We considered using an HTML prefetch link, then reading it with `fetch(..., { cache: 'only-if-cached' })` solely for discovery. That loses asset discovery when HTML is not stored: the link exposes no response body, and its load event does not guarantee a cache entry.[prefetch-hints] A fallback network fetch could recover the HTML, but adds another speculative request for an uncacheable page. Fetching the HTML ourselves from the start avoids that dependency on storage.

Adding an HTML prefetch link after our fetch is also unnecessary. It can read an already fresh entry, but cannot make a `no-store` response reusable. The chosen strategy needs neither that extra hint nor the cache-only probe used by options 2 and 3.

## Request priority and prefetch metadata

We chose `priority: 'low'` for the HTML discovery fetch and `fetchPriority = 'low'` for asset links. These express that the work is speculative while leaving scheduling to the browser. They do not guarantee the same network priority as a native HTML prefetch link.

We considered setting `Sec-Purpose: prefetch` on the HTML fetch to align it with native prefetch requests. The Fetch standard reserves `Sec-` request headers for the browser, so application JavaScript cannot set that header.[forbidden-headers] A low-priority fetch remains an ordinary fetch; it does not acquire native prefetch metadata or a separate caching contract. Keeping its frame headers aligned with navigation also avoids introducing a prefetch-specific variant when a server varies on that metadata.

## Tradeoffs we accepted

The benefit is asset warming with a small ownership boundary: Remix discovers URLs and creates hints; the browser schedules asset fetches and manages cached bytes; navigation keeps its existing resolver behavior.

The cost is that uncacheable HTML must be fetched again on navigation, even after prefetch finishes. We deliberately give up userland reuse of that response. This also avoids a second freshness policy, one-use response ownership, response cloning for handoff, FIFO eviction, expiration timers, and invalidation after mutations.

An early navigation does not explicitly join the discovery request. Browsers can coordinate overlapping requests, but we do not guarantee one wire request or a particular completion order. Our browser checks encountered different overlap behavior between Chromium and Firefox. The contract is that the default navigation fetch starts independently of the userland prefetch map.

Other limits follow from the chosen mechanisms:

- Asset prefetch links are hints; browsers may defer or ignore them. The runtime feature-detects support and skips unsupported asset hints. Navigation still works.
- The runtime reads the complete HTML body before discovering assets. Nested streamed templates are inspected after that read; this is not incremental discovery as chunks arrive.
- Repeated intent after work completes can initiate another HTML fetch. A fresh cache entry can satisfy it, but repeated speculation against `no-store` HTML can produce additional network requests.
- Removing a completed link does not reserve cached bytes. Later requests can still miss or revalidate. Network-panel request rows can represent cache reads, so server request counts and transferred bytes matter when assessing reuse.

## Evidence and extension points

The four-strategy demo was the evaluation tool. After selecting HTML discovery, we removed its custom implementations, cookie-backed selector, response cache, and diagnostic request header. The demo now exercises the framework default with artificial HTML and asset delays.

`packages/component/src/test/default-prefetch.test.ts` covers inert discovery, nested templates, base URLs, final response URLs, active assets, request attributes, pending-work deduplication, failed responses, and disposal. `prefetch.test.ts` covers intent detection, eligibility, override hooks, default frame request headers, and the low-priority HTML fetch. The demo's `app/app.test.e2e.ts` checks browser HTTP cache reuse, asset warming for `no-store` HTML, independent navigation while discovery streams, and pending hints surviving frame navigation. These are functional checks, not a claim that one strategy is fastest for every application.

## Custom resolvers delegate through an exported helper

Applications can still choose a custom `prefetch` and `resolveFrame` when response handoff is valuable. We exported `defaultResolveFrame` from `remix/component` so those resolvers can delegate misses without copying submission encoding, headers, cancellation, or response handling:

```ts
import { run, defaultResolveFrame } from 'remix/component'

run({
  loadModule,
  resolveFrame(src, options) {
    let isGet = !options?.method || options.method.toUpperCase() === 'GET'
    let response = options?.target == null && isGet ? cache.take(src) : undefined
    return response ?? defaultResolveFrame(src, options)
  },
})
```

Here `cache` is application-owned; this is an extension point, not a cache provided by the default strategy. The default resolver remains independent of prefetching, and prefetching remains GET-only. Applications must forward both `src` and `options` when delegating so named-frame targeting, submissions, and cancellation retain their normal behavior.

We initially injected a request-bound `options.defaultResolveFrame()` callback into every resolver call. That required changing the resolver options contract and adding plumbing to both frame reloads and initial client-frame resolution. An import gives applications the same fallback without changing either call path. `ResolveFrame` retains its existing `(src: string, options?: ResolveFrameOptions)` parameters.

The implementation and form-encoding helpers stay in `packages/component/src/runtime/run.ts`, where the default resolver already lived. Once frame loading no longer imports the helper to construct callbacks, the separate `runtime/default-resolve-frame.ts` module has no remaining purpose and was removed. The public entry point exports the function directly from `run.ts`. Tests in `frame.test.ts` exercise the public export, cache hits that avoid fetching, delegated named-frame submissions, and initial client-frame loads.

The chosen default needs no custom resolver or application-provided container markup.

## When to revisit

1. Measurements show that losing HTML handoff dominates navigation latency for common applications with uncacheable HTML, enough to justify the additional cache and invalidation contract.
2. Browser support or scheduling makes asset prefetch hints ineffective for important target environments, warranting a different hint strategy or an explicit fallback.
3. Streaming HTML delays asset discovery enough to justify incremental parsing rather than waiting for the full response body.

[base-pr]: https://github.com/remix-run/remix/pull/12004
[base-commit]: https://github.com/remix-run/remix/commit/4c6a6989b51295501fb0ae2ee44f14a453664af9
[prefetch-hints]: https://html.spec.whatwg.org/multipage/links.html#link-type-prefetch
[templates]: https://html.spec.whatwg.org/multipage/scripting.html#the-template-element
[modulepreload]: https://html.spec.whatwg.org/multipage/links.html#link-type-modulepreload
[http-cache]: https://www.rfc-editor.org/rfc/rfc9111.html
[chrome-prefetch-cache]: https://developer.chrome.com/release-notes/133
[forbidden-headers]: https://fetch.spec.whatwg.org/#forbidden-request-header
