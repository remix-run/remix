---
title: meta
---

# `meta`

<docs-warning>The route `meta` export signature is changing in v2. You can prepare for this change at your convenience with the `v2_meta` future flag. For instructions on making this change see the [v2 guide][v2guide].</docs-warning>

The `meta` export allows you to add metadata HTML tags for every route in your app. These tags are important for things like search engine optimization (SEO) and browser directives for determining certain behaviors. They can also be used by social media sites to display rich previews of your app.

The meta export will set meta tags for your html document. We highly recommend setting the title and description on every route aside from layout routes, as a layout's index route will set the meta for the index path.

```tsx
import type { MetaFunction } from "@remix-run/node"; // or cloudflare/deno

export const meta: MetaFunction = () => {
  return {
    title: "Something cool",
    description:
      "This becomes the nice preview on search results.",
  };
};
```

<docs-warning>The `meta` function _may_ run on the server (e.g. the initial page load) or the client (e.g. a client navigation), so you cannot access server-specific data like `process.env.NODE_ENV` directly. If you need server-side data in `meta`, get the data in the `loader` and access it via the `meta` function's `data` parameter.</docs-warning>

There are a few special cases (read about those below). In the case of nested routes, the meta tags are merged automatically, so parent routes can add meta tags without the child routes needing to copy them.

## `HtmlMetaDescriptor`

This is an object representation and abstraction of a `<meta {...props}>` element and its attributes. [View the MDN docs for the meta API][mdn-meta].

The `meta` export from a route should return a single `HtmlMetaDescriptor` object.

Almost every `meta` element takes a `name` and `content` attribute, with the exception of [OpenGraph tags][open-graph-tags] which use `property` instead of `name`. In either case, the attributes represent a key/value pair for each tag. Each pair in the `HtmlMetaDescriptor` object represents a separate `meta` element, and Remix maps each to the correct attributes for that tag.

The `meta` object can also hold a `title` reference which maps to the [HTML `<title>` element][html-title-element].

As a convenience, `charset: "utf-8"` will render a `<meta charset="utf-8">`.

As a last option, you can also pass an object of attribute/value pairs as the value. This can be used as an escape-hatch for meta tags like the [`http-equiv` tag][http-equiv-tag] which uses `http-equiv` instead of `name`.

Examples:

```tsx
import type { MetaFunction } from "@remix-run/node"; // or cloudflare/deno

export const meta: MetaFunction = () => ({
  // Special cases
  charset: "utf-8", // <meta charset="utf-8">
  "og:image": "https://josiesshakeshack.com/logo.jpg", // <meta property="og:image" content="https://josiesshakeshack.com/logo.jpg">
  title: "Josie's Shake Shack", // <title>Josie's Shake Shack</title>

  // name => content
  description: "Delicious shakes", // <meta name="description" content="Delicious shakes">
  viewport: "width=device-width, initial-scale=1", // <meta name="viewport" content="width=device-width, initial-scale=1">

  // <meta {...value}>
  refresh: {
    httpEquiv: "refresh",
    content: "3;url=https://www.mozilla.org",
  }, // <meta http-equiv="refresh" content="3;url=https://www.mozilla.org">
});
```

## Page context in `meta` function

`meta` function is passed an object that has following data:

- `data` is whatever exported by `loader` function
- `location` is a `window.location`-like object that has some data about the current route
- `params` is an object containing route params
- `parentsData` is a hashmap of all the data exported by `loader` functions of current route and all of its parents

```tsx
export const meta: MetaFunction<typeof loader> = ({
  data,
  params,
}) => {
  if (!data) {
    return {
      title: "Missing Shake",
      description: `There is no shake with the ID of ${params.shakeId}. 😢`,
    };
  }

  const { shake } = data;
  return {
    title: `${shake.name} milkshake`,
    description: shake.summary,
  };
};
```

To infer types for `parentsData`, provide a mapping from the route's file path (relative to `app/`) to that route loader type:

```tsx filename=app/routes/sales.tsx
export const loader = async () => {
  return json({ salesCount: 1074 });
};
```

```tsx
import type { loader as salesLoader } from "../../sales";

export const loader = async () => {
  return json({ name: "Customer name" });
};

const meta: MetaFunction<
  typeof loader,
  { "routes/sales": typeof salesLoader }
> = ({ data, parentsData }) => {
  const { name } = data;
  //      ^? string
  const { salesCount } = parentsData["routes/sales"];
  //      ^? number
};
```

[mdn-meta]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta
[open-graph-tags]: https://ogp.me
[html-title-element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title
[http-equiv-tag]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-http-equiv
[meta-v2]: #metav2
[root-route]: ../file-conventions/root
[matches]: #matches
[index-route]: ../guides/routing#index-routes
[merge-meta]: https://gist.github.com/ryanflorence/ec1849c6d690cfbffcb408ecd633e069
[url-params]: ../guides/routing#dynamic-segments
[use-matches]: ../hooks/use-matches
[merging-metadata-across-the-route-hierarchy]: #md-merging-with-parent-meta
[links-export]: ./links
[v2guide]: ../pages/v2#route-meta
