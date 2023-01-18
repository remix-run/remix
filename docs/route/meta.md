---
title: meta
---

# `meta`

<docs-info>Meta is changing in v2, you can opt-in to the new API today, [see the meta v2 section][meta-v2].</docs-info>

The meta export defines object representations of `<meta>` tags for a route. These tags are important for SEO, browser behavior, and more.

The meta export will set meta tags for your html document. We highly recommend setting the title and description on every route besides layout routes (their index route will set the meta).

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
  viewport: "width=device-width,initial-scale=1", // <meta name="viewport" content="width=device-width,initial-scale=1">

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

---

# `meta@v2`

You can enable the new meta API with a future flag in `remix.config.js`

```js filename=remix.config.js
module.exports = {
  future: {
    v2_meta: true,
  },
};
```

The meta export allows you to add `<meta>` tags for every route in your app, including nested routes. These tags are important for SEO, browser behavior, and more.

```tsx
import type { V2_MetaFunction } from "@remix-run/node";

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "New Remix App",
    },
    {
      name: "description",
      content: "This app is a wildly dynamic web app",
    },
  ];
};
```

Meta functions return an array of `V2_HtmlMetaDescriptor` objects. These objects map one-to-one with normal HTML meta tags:

```tsx
const description = {
  name: "description",
  content: "This is my website description",
};
// becomes
<meta
  name="description"
  content="This is my website description"
/>;

const ogTitle = {
  property: "og:title",
  content: "My Website Title",
};
// becomes
<meta property="og:title" content="My Website Title" />;
```

The one exception is the the `title` tag since it's not a `<meta>` tag but acts as one.

```tsx
const title = {
  title: "My highly dynamic web *APP* with deep sessions",
};
// becomes
<title>
  My highly dynamic web *APP* with deep sessions
</title>;
```

## `matches`

This is a list of hte current route matches. You have access many things, particularly the meta from the parent matches and data.

It's most useful for merging the parent meta into the child meta since the child meta value is what will be used:

```tsx
export const meta = ({ matches }) => {
  let parentMeta = matches.map((match) => match.meta ?? []);
  return [...parentMeta, { title: "Projects" }];
};
```

## `data`

This is the data from your loader.

```tsx
export function loader({ params }) {
  return getTask(params.projectId, params.taskId);
}

export function meta({ data }) {
  return [{ title: data.task.name }];
}
```

## `parentsData`

Often you'll need the data from a parent route, you can look it up by route ID on `parentsData`

```tsx filename=routes/project/$pid/tasks/$tid.tsx
export function loader({ params }) {
  return getTask(params.tid);
}

export function meta({ data, parentsData }) {
  let project = parentsData["routes/project/$pid"].project;
  let task = data.task;
  return [{ title: `${project.name}: ${task.name}` }];
}
```

## `params`

The route URL params. See [Dynamic Segments in the Routing Guide][url-params].

## Gotchas with `meta` and Nested Routes

Because multiple nested routes render at the same time, there is some merging that needs to happen to determine the meta tags that ultimately render. Remix gives you complete control over this merge because there is no obvious default.

Remix will take the last matching route with a meta export and use that. This allows you to override things like `title`, remove things like `og:image` that the parent route added, or keep everything from the parent and add new meta for the child route.

This can get quite tricky when you're new.

Consider a route like `/projects/123`, there are likely three matching routes: `root.tsx`, `projects.tsx`, and `projects/$id.tsx`. All three may export meta descriptors.

```tsx bad filename=app/root.tsx
export const meta = () => {
  return [
    {
      name: "viewport",
      content: "width=device-width,initial-scale=1",
    },
    { title: "New Remix App" },
  ];
};
```

```tsx bad filename=app/routes/projects.tsx
export const meta = () => {
  return [{ title: "Projects" }];
};
```

```tsx bad filename=app/routes/projects/$id.tsx
export const meta: V2_MetaFunction = ({ data }) => {
  return [{ title: data.project.name }];
};
```

With this code, we will lose the `viewport` meta tag at `/projects` and `/projects/123` because only the last meta is used and the code doesn't merge with the parent.

### Global Meta

Nearly every app will have global meta like the `viewport` and `charSet`. We recommend using normal `<meta>` tags inside of the [root route][root-route] instead of the `meta` export so you simply don't have to deal with merging:

```tsx filename=app/root.tsx lines=[12-16]
import {
  Meta,
  Links,
  Scripts,
  Outlet,
} from "@remix-run/react";

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
```

### Avoid Meta in Parent Routes

You can also avoid the merge problem by simply not exporting meta that you want to override from parent routes. Instead of defining meta on the parent route, use the [index route][index-route]. This way you can avoid complex merge logic for things the title. Otherwise you will need to find the parent title descriptor and replace it with the child's title. It's much easier to simply not need to override by using index routes.

### Merging with Parent Meta

Usually you only need to add meta to what the parent has already defined. You can merge parent meta with the spread operator and the [`matches`][matches] arg:

```tsx
export const meta = ({ matches }) => {
  let parentMeta = matches.map((match) => match.meta ?? []);
  return [...parentMeta, { title: "Projects" }];
};
```

Note that this _will not_ override something like `title`. This is only additive.

### Meta Merging helper

If you can't avoid the merge problem with global meta or index routes, we've created a helper that you can put in your app that can override and append to parent meta easily.

- [View Gist for `merge-meta.ts`][merge-meta]

[mdn-meta]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta
[open-graph-tags]: https://ogp.me
[html-title-element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title
[http-equiv-tag]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-http-equiv
[meta-v2]: #metav2
[root-route]: ../file-conventions/root
[matches]: #matches
[index-routes]: ../guides/routing#index-routes
[merge-meta]: https://gist.github.com/ryanflorence/ec1849c6d690cfbffcb408ecd633e069
[url-params]: ../guides/routing#dynamic-segments
