---
title: Cache-Control
hidden: true
---

# Cache Control

## In Routes Modules

Each route can also define its http headers. This is mostly important for http caching. Remix doesn't rely on building your website into static files to be uploaded to a CDN for performance, instead we rely on cache headers. The end result of either approach is the same: a static document on a CDN. [Check out this video for more information on that](https://youtu.be/bfLFHp7Sbkg).

Usually, the difficulty with cache headers is configuring them. In Remix we've made it easy. Just export a `headers` function from your route.

```tsx
export function headers() {
  return {
    "Cache-Control": "public, max-age=300, s-maxage=3600"
  };
}

export function meta() {
  /* ... */
}

export default function Gists() {
  /* ... */
}
```

The max-age tells the user's browser to cache this for 300 seconds, or 5 minutes. That means if they click back or on a link to the same page again within 5 minutes, the browser won't even make a request for the page, it will use the cache.

The s-maxage tells the CDN to cache it for an hour. Here's what it looks like when the first person visits our website:

1. Request comes in to the website, which is really the CDN
2. CDN doesn't have the document cached, so it makes a request to our server (the "origin server").
3. Our server builds the page and sends it to the CDN
4. The CDN caches it and sends it to the visitor.

Now, when the next person visits our page, it looks like this:

1. Request comes to the CDN
2. CDN has the document cached already and sends it right away without ever touching our origin server!

We have a lot more to say about caching in the [CDN Caching](../guides/caching) guide, make sure to read it sometime.

## In Loaders

We saw that our routes can define their cache control, so why does it matter for loaders? It matters for two reasons:

First, your data usually knows better what the cache control should be than your route because the data changes more often than the markup. Because of this, the loader's headers are passed to the route's header function.

Open up `app/routes/gists.ts` and update your headers function like so:

```tsx
export function headers({
  loaderHeaders
}: {
  loaderHeaders: Headers;
}) {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control")
  };
}
```

The `loaderHeaders` object is an instance of the [Web Fetch API Headers constructor](https://developer.mozilla.org/en-US/docs/Web/API/Headers)

Now when the browser or a CDN wants to cache our page, it gets the headers from our data source, which is usually what you want. Note in our case we're actually just using headers GitHub sent in the response from our fetch!

The second reason this matters is that Remix calls your loaders via `fetch` in the browser on client side transitions. By returning good cache headers here, when the user clicks back/forward or visits the same page multiple times, the browser won't actually make another request for the data but will use a cached version instead. This greatly speeds up a website's performance, even for pages that you can't cache on a CDN. A lot of React apps rely on a JavaScript cache, but browser caches already work great!
