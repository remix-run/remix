---
title: links
---

# `links`

The links function defines which [`<link>` element][link-element]s to add to the page when the user visits a route.

```tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

export const links: LinksFunction = () => {
  return [
    {
      rel: "icon",
      href: "/favicon.png",
      type: "image/png",
    },
    {
      rel: "stylesheet",
      href: "https://example.com/some/styles.css",
    },
    { page: "/users/123" },
    {
      rel: "preload",
      href: "/images/banner.jpg",
      as: "image",
    },
  ];
};
```

There are two types of link descriptors you can return:

#### `HtmlLinkDescriptor`

This is an object representation of a normal `<link {...props} />` element. [View the MDN docs for the link API][link-element].

The `links` export from a route should return an array of `HtmlLinkDescriptor` objects.

Examples:

```tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import stylesHref from "../styles/something.css";

export const links: LinksFunction = () => {
  return [
    // add a favicon
    {
      rel: "icon",
      href: "/favicon.png",
      type: "image/png",
    },

    // add an external stylesheet
    {
      rel: "stylesheet",
      href: "https://example.com/some/styles.css",
      crossOrigin: "anonymous",
    },

    // add a local stylesheet, remix will fingerprint the file name for
    // production caching
    { rel: "stylesheet", href: stylesHref },

    // prefetch an image into the browser cache that the user is likely to see
    // as they interact with this page, perhaps they click a button to reveal in
    // a summary/details element
    {
      rel: "prefetch",
      as: "image",
      href: "/img/bunny.jpg",
    },

    // only prefetch it if they're on a bigger screen
    {
      rel: "prefetch",
      as: "image",
      href: "/img/bunny.jpg",
      media: "(min-width: 1000px)",
    },
  ];
};
```

#### `PageLinkDescriptor`

These descriptors allow you to prefetch the resources for a page the user is likely to navigate to. While this API is useful, you might get more mileage out of `<Link prefetch="render">` instead. But if you'd like, you can get the same behavior with this API.

```tsx
export const links: LinksFunction = () => {
  return [{ page: "/posts/public" }];
};
```

This loads up the JavaScript modules, loader data, and the stylesheets (defined in the `links` exports of the remix routes) into the browser cache before the user even navigates there.

<docs-warning>Be careful with this feature. You don't want to download 10MB of JavaScript and data for pages the user probably won't ever visit.</docs-warning>

[link-element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link
