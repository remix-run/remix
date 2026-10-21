# Discover prefetch assets from HTML and use the browser cache

We chose HTML discovery with asset prefetch tags as the direction for Remix's default frame prefetching. Remix fetches a destination's HTML, parses it without activating the page, and creates prefetch hints for its explicit JavaScript, CSS, and image and font preload URLs. Navigation uses the normal frame resolver. The browser owns response caching and revalidation.

This extends the HTML-only prefetching in [PR #12004][base-pr]. We evaluated four strategies in a dedicated prefetch demo, then promoted HTML discovery into the component runtime. The bookstore now demonstrates that default, including intent and viewport triggers, browser caching, and explicit image preloads. We removed the evaluation demo after moving its unique browser regression checks into the bookstore suite.

## Starting point

The evaluation branch, `brophdawg11/codex-prefetch-assets`, starts from `brookslybrand/link-prefetch-intent` in PR #12004, **Prefetch links on intent with data-rmx-prefetch**, at commit [`4c6a6989b51295501fb0ae2ee44f14a453664af9`][base-commit].

That branch establishes when and which pages Remix prefetches:

- `data-rmx-prefetch="intent"` starts a prefetch after 100ms of mouse or keyboard focus, or immediately on pointer press.
- `prefetch(href)` starts the same work programmatically, such as when a search narrows to one result.
- Only another same-origin URL eligible for an untargeted top-frame navigation is considered. The current page, downloads, document navigations, named-frame links, and links opening another browsing context are excluded. URL fragments are removed.
- Prefetching is opt-in. Marked GET routes must be safe to request speculatively; submissions are not prefetched.
- `run({ prefetch })` lets applications replace the loading strategy while retaining Remix's intent detection and link eligibility rules.

The original default creates an HTML `<link rel="prefetch">`. It does not read the response or discover destination assets. This helps HTML delivery when the response is reusable, but destination client entries and stylesheets can still need network requests after navigation. Our decision changes the loading strategy and extends eligible links to mounted named frames.

## Prefetch triggers in the initial release

We chose to ship `data-rmx-prefetch="intent"` and `data-rmx-prefetch="viewport"`. Intent starts discovery after the visitor rests on a link or presses it. Viewport starts the same discovery when the link enters view. Rendering a link alone does not trigger a prefetch; there is no `render` strategy. The imperative `prefetch(href)` API remains available for application-specific triggers.

Viewport support lives in `packages/component/src/runtime/prefetch.ts` and uses the same frame-navigation eligibility checks as intent links. One `IntersectionObserver` tracks visibility, and one `MutationObserver` registers links inserted or changed by streaming, frame navigation, or client rendering. Each mounted link triggers once for its current normalized frame source and target. Leaving and reentering view does not trigger again; a source or target change or a later mount makes the link eligible again. This tracking retains no responses. Runtime disposal disconnects both observers, and browsers without `IntersectionObserver` skip viewport prefetching.

Both triggers support `data-rmx-target` and `data-rmx-src`. A named-frame link prefetches its source override, or `href` when no override is present, and sends the selected frame name. The browser navigation destination remains `href`. Both URLs must be same-origin, and the named frame must be mounted when the trigger runs; a missing target would fall back to document navigation, so its frame response is not prefetched. Without a nonempty target, a valid source override is ignored, matching top-frame navigation. Downloads, explicit document navigations, and links opening another browsing context remain excluded. Untargeted requests skip the current page; named-frame sources can use its URL because their target selects different content. `prefetch(src, { target })` provides the same request context imperatively, and `run({ prefetch })` receives that context as an optional second argument.

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

The default implementation lives alongside intent, viewport, and eligibility handling in `packages/component/src/runtime/prefetch.ts`. Applications can replace the loading strategy with an override. Only the shared set of pending asset links lives in `prefetch-links.ts`, so frame reconciliation can preserve those links without importing the prefetch runtime.

1. Normalize the same-origin frame source and make a GET with `priority: 'low'` and the normal frame headers, `Accept: text/html` and `X-Remix-Frame: true`, plus `X-Remix-Target` for named frames. Use ordinary fetch caching behavior.
2. Read a successful HTML response into a detached `<template>`. Resolve asset URLs against the final response URL after redirects, honoring its first `<base href>`.
3. Find external scripts, stylesheet links, module preload links, and script/style/image/font preload links. Recursively inspect nested template contents, including assets carried in streamed frame templates.
4. Skip matching assets already active in the current document and deduplicate pending asset hints. Create new script/style/image/font **prefetch** links, preserving the relevant CORS, integrity, and referrer attributes.
5. Keep hints connected while they load, including across a frame navigation. Remove each hint on load or error. The runtime tracks its own pending head links and excludes them from document head reconciliation so navigation does not cancel unfinished work. Runtime disposal cancels speculative HTML requests and removes pending hints.
6. Discard the consumed HTML. On navigation, use the default resolver, which performs its normal request and lets the browser decide whether to reuse, validate, or fetch a response.

A map of pending discovery work, keyed by normalized source and target, prevents overlapping prefetch calls from starting identical work in userland. Different targets may return different HTML at the same URL, so they must not share discovery work. Asset hints remain deduplicated across targets. Entries disappear when that work finishes. The map contains no completed response cache, has no expiration policy, and is never consulted by navigation. Failures remain speculative and do not replace or block the normal navigation path.

## Inert parsing and import maps

We need the destination's asset URLs without mounting its DOM or booting its application. A detached template provides queryable contents without activating the parsed scripts, import maps, or styles.[templates] The discovery code creates fresh resource hints; it never inserts the parsed destination nodes into the active document.

We considered loading the destination in a hidden iframe so the browser could discover resources using that document's import map. A normal iframe also runs the destination application. Preventing that reliably would require a separate execution policy or server response mode, so we rejected it for this default.

We also avoid copying destination `modulepreload` links into the current document as module preloads. Module preloading can fetch a dependency graph using the current document's module environment.[modulepreload] That is the wrong environment when the destination has a different import map. Instead, we read the explicit URL attributes and warm their bytes with ordinary asset prefetch hints. The destination's import map and module graph are handled during actual navigation.

This deliberately stops at explicit URLs. It does not resolve bare imports, traverse JavaScript dependencies, parse CSS `@import`, or discover CSS images and fonts. Assets that need warming must appear in the HTML's resource declarations.

Image discovery follows explicit `<link rel="preload" as="image" href="…">` declarations rather than scanning every `<img>`. Authors can choose which destination images warrant speculative loading. Image media conditions must match, and declarations with `imagesrcset` are skipped: ordinary prefetch hints cannot select responsive image candidates.[image-preloads]

Font discovery likewise follows explicit `<link rel="preload" as="font" href="…" crossorigin>` declarations with matching media conditions. It preserves the declared CORS setting, allowing authors to match the anonymous CORS requests used for CSS fonts.[font-fetching] It does not parse `@font-face` rules or choose font weights and character subsets from stylesheets.

## Browser caching remains authoritative

HTML does not need a particular cache policy for **asset discovery**: our fetch can read even a `no-store` response. Reusing that HTML on navigation is a separate matter, governed by the server's policy:

| HTML cache policy     | Navigation behavior                                                    |
| --------------------- | ---------------------------------------------------------------------- |
| `private, max-age=30` | The browser may reuse a matching fresh response                        |
| `no-cache`            | Storage is allowed, but reuse requires validation                      |
| `no-store`            | The response cannot be stored for reuse; navigation fetches HTML again |

These are HTTP cache rules, not Remix freshness rules.[http-cache] Assets have their own independent response policies. Fingerprinted assets with long freshness can remain useful even when their containing HTML cannot be cached.

An HTML prefetch link does not give us a portable five-minute reuse window when the response has no explicit freshness lifetime. Chrome removed its special five-minute rule in version 133 and now applies normal HTTP cache semantics to link prefetches.[chrome-prefetch-cache] We therefore rely on the server's cache policy for both HTML fetches and asset hints, rather than choosing HTML links for an assumed cache lifetime.

Reuse also requires a matching cache entry, including request variants selected by `Vary`. Using the normal frame headers avoids the original HTML link strategy's inability to send `X-Remix-Frame` and `X-Remix-Target`. Servers that select different HTML by target must vary cacheable responses on `X-Remix-Target`. Aligned headers do not override variant matching, credentials, cache partitioning, eviction, or browser resource policies.

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
- A new intent interaction or programmatic call after work completes can initiate another HTML fetch. Hover and focus are tracked independently, with one prefetch per link while either remains active. Descendant pointer movement and a later press during that interaction do not repeat it; pressing before the intent delay still starts it immediately. A fresh cache entry can satisfy later prefetches, but repeated speculation against `no-store` HTML can produce additional network requests.
- Removing a completed link does not reserve cached bytes. Later requests can still miss or revalidate. Network-panel request rows can represent cache reads, so server request counts and transferred bytes matter when assessing reuse.

## Evidence and extension points

The four-strategy demo was the evaluation tool. After selecting HTML discovery, we removed its custom implementations, cookie-backed selector, response cache, and diagnostic request header. We later removed the demo itself once the bookstore demonstrated the framework default. The bookstore uses intent on header links and viewport on “View Details” links, privately caches browsing frame GETs for 30 seconds, and serves fingerprinted images with a preload for the main product image.

`packages/component/src/test/default-prefetch.test.ts` covers inert discovery, nested templates, base URLs, final response URLs, active assets, image and font preload declarations, media conditions, responsive image exclusions, request attributes, pending-work deduplication, failed responses, and disposal. `prefetch.test.ts` covers intent detection, viewport entry, dynamic links, changed destinations, eligibility, observer disposal, override hooks, default frame request headers, and the low-priority HTML fetch. The bookstore's `app/prefetch.test.e2e.ts` exercises built-in intent and viewport links through real frame navigation, browser HTTP cache reuse, asset warming for `no-store` HTML, independent navigation while discovery streams, and pending hints surviving frame navigation. These are functional checks, not a claim that one strategy is fastest for every application.

## Keep customization hooks and defer helper exports

Applications can still choose a custom `prefetch` and `resolveFrame` when response handoff is valuable. Both hooks receive the frame source and optional target; a custom response cache must distinguish those variants. Those hooks replace the default behavior, so applications own their fetch implementation, submission encoding, cancellation, response handling, and any cache lifetime or invalidation. The chosen default needs no custom resolver or application-provided container markup.

We considered both an injected `options.defaultResolveFrame()` callback and an exported `defaultResolveFrame(src, options)` helper. The callback required changing the resolver options contract and plumbing it through frame reloads and initial client-frame resolution. A direct export avoided that plumbing, but neither the chosen default nor the demo needs it. We deferred both forms until an application has a concrete need to compose the built-in behavior. `ResolveFrame` retains its existing `(src: string, options?: ResolveFrameOptions)` parameters.

The same reasoning applies to exporting `defaultPrefetch`. A cache-first resolver or a prefetch wrapper for filtering or logging could justify helper exports later. Calling the public `prefetch()` function from a custom prefetch hook would recurse, so composition would need access to the default implementation if that use case arises.

The private resolver and its form-encoding helpers remain in `packages/component/src/runtime/run.ts`. There is no separate `runtime/default-resolve-frame.ts` module or additional resolver plumbing.

## When to revisit

1. Measurements show that losing HTML handoff dominates navigation latency for common applications with uncacheable HTML, enough to justify the additional cache and invalidation contract.
2. Browser support or scheduling makes asset prefetch hints ineffective for important target environments, warranting a different hint strategy or an explicit fallback.
3. Streaming HTML delays asset discovery enough to justify incremental parsing rather than waiting for the full response body.
4. An application needs to compose the built-in resolver or prefetch behavior, giving us a concrete consumer for a public helper contract.

[base-pr]: https://github.com/remix-run/remix/pull/12004
[base-commit]: https://github.com/remix-run/remix/commit/4c6a6989b51295501fb0ae2ee44f14a453664af9
[prefetch-hints]: https://html.spec.whatwg.org/multipage/links.html#link-type-prefetch
[templates]: https://html.spec.whatwg.org/multipage/scripting.html#the-template-element
[modulepreload]: https://html.spec.whatwg.org/multipage/links.html#link-type-modulepreload
[image-preloads]: https://html.spec.whatwg.org/multipage/semantics.html#attr-link-imagesrcset
[font-fetching]: https://www.w3.org/TR/css-fonts-4/#font-fetching-requirements
[http-cache]: https://www.rfc-editor.org/rfc/rfc9111.html
[chrome-prefetch-cache]: https://developer.chrome.com/release-notes/133
[forbidden-headers]: https://fetch.spec.whatwg.org/#forbidden-request-header
