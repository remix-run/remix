---
title: Fog of War
---

# Fog Of War

<docs-warning>This is an unstable API and will continue to change, do not adopt in production</docs-warning>

Remix introduced support for "Fog of War" ([RFC][rfc]) behind the `future.unstable_fogOfWar` [Future Flag][future-flags] in [`v2.10.0`][2.10.0]. This allows you to opt-into this behavior which will become the default in the next major version of Remix - a.k.a. React Router v7 ([1][rr-v7], [2][rr-v7-2]).

## Current Behavior

Currently, Remix loads the complete route manifest in a JS file on initial load (i.e., `/assets/manifest-[hash].js`). The manifest does not contain the route module implementations, but rather their URL paths and meta information (route JS/CSS imports, whether they have a `loader`/`action` on the server, etc.). Having this full manifest up-front allows Remix to do synchronous client-side route matching on Link clicks and kick off the loads for route modules and data immediately. For small-to-medium-sized apps, loading the full manifest up-front is usually not prohibitive as it is highly cacheable and gzips down quite well. However, at scale we found that this manifest could grow large enough to impact some performance metrics.

## New Behavior

When you enable "Fog of War", Remix will no longer send a full route manifest on initial load. Instead, your SSR render will only include the SSR routes in the initial manifest and additional routes will be loaded as the user navigates around the application. Over time, the manifest grows to include the portions of the app the user navigated to.

### Eager Route Discovery

As always, there is a tradeoff with this type of lazy-route discovery. It improves initial application load times -- but Remix can no longer perform synchronous route matching on link clicks, which can lead to waterfalls.

In the current architecture (without using `<Link prefetch>`), clicking a link would look something like this:

```
click /a
        |-- load route module -->
        |-- load route data -->
                                 | render /a
```

In the Fog of War architecture, clicking a link can introduce a waterfall:

```
click /a
        |-- discover route -->
                              |-- load route module -->
                              |-- load route data -->
                                                       | render /a
```

As we all know, Remix hates waterfalls, so the Fog of War feature implements an optimization to avoid them in the majority of cases. By default, all [`<Link>`][link] and [`<NavLink>`][navlink] components rendered on the page will be batched up and eagerly "discovered" via a request to the server. This request will match all current link paths on the server and send back all required route manifest entries. Under the majority of cases, this request should complete prior to the user clicking any links (since users don't usually click links in the first few hundred milliseconds) and the manifest will be patched before any links are clicked. Then, when a link is clicked, Remix is able to do synchronous client-side matching as if the Fog of War behavior wasn't even present.

If you wish to opt-out of this eager route discovery on a per-link basis, you can do that via the [`discover="none"`][link-discover] prop (the default value is `discover="render"`).

### Notable Changes

- When this feature is enabled, the route manifest in `window.__remixManifest.routes` will only contain the minimal required routes on initial SSR, and routes will be added to it dynamically as the user navigates around
- The Remix handler now has a new internal `/__manifest` endpoint through which it will fetch manifest patches
  - ⚠️ This is considered an internal implementation detail and is not intended to be requested by application code.

[rfc]: https://github.com/remix-run/react-router/discussions/11113
[future-flags]: ../guides/api-development-strategy
[2.10.0]: https://github.com/remix-run/remix/blob/main/CHANGELOG.md#v2100
[link]: ../components/link
[navlink]: ../components/nav-link
[link-discover]: ../components/link#discover
[rr-v7]: https://remix.run/blog/merging-remix-and-react-router
[rr-v7-2]: https://remix.run/blog/incremental-path-to-react-19
