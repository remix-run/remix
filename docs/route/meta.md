---
title: meta
---

# `meta`

The `meta` export allows you to add metadata HTML tags for every route in your app. These tags are important for things like search engine optimization (SEO) and browser directives for determining certain behaviors. They can also be used by social media sites to display rich previews of your app.

The `meta` function should return an array of `MetaDescriptor` objects. These objects map one-to-one with HTML tags. So this meta function:

```tsx
export const meta: MetaFunction = () => {
  return [
    { title: "Very cool app | Remix" },
    {
      property: "og:title",
      content: "Very cool app",
    },
    {
      name: "description",
      content: "This app is the best",
    },
  ];
};
```

produces this HTML:

```html
<title>Very cool app | Remix</title>
<meta property="og:title" content="Very cool app" />;
<meta name="description" content="This app is the best" />
```

By default, meta-descriptors will render a [`<meta>` tag][meta-element] in most cases. The two exceptions are:

- `{ title }` renders a `<title>` tag
- `{ "script:ld+json" }` renders a `<script type="application/ld+json">` tag, and its value should be a serializable object that is stringified and injected into the tag.

```tsx
export const meta: MetaFunction = () => {
  return [
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Remix",
        url: "https://remix.run",
      },
    },
  ];
};
```

A meta-descriptor can also render a [`<link>` tag][link-element] by setting the `tagName` property to `"link"`. This is useful for `<link>` tags associated with SEO like `canonical` URLs. For asset links like stylesheets and favicons, you should use the [`links` export][links] instead.

```tsx
export const meta: MetaFunction = () => {
  return [
    {
      tagName: "link",
      rel: "canonical",
      href: "https://remix.run",
    },
  ];
};
```

## `meta` Function Parameters

### `location`

This is the current router `Location` object. This is useful for generating tags for routes at specific paths or query parameters.

```tsx
export const meta: MetaFunction = ({ location }) => {
  const searchQuery = new URLSearchParams(
    location.search
  ).get("q");
  return [{ title: `Search results for "${searchQuery}"` }];
};
```

### `matches`

This is an array of the current route matches. You have access to many things, particularly the meta from the parent matches and data.

The interface for `matches` is similar to the return value of [`useMatches`][use-matches], but each match will include the output of its `meta` function. This is useful for [merging metadata across the route hierarchy][merging-metadata-across-the-route-hierarchy].

### `data`

This is the data from your route's [`loader`][loader].

```tsx
export async function loader({
  params,
}: LoaderFunctionArgs) {
  return json({
    task: await getTask(params.projectId, params.taskId),
  });
}

export const meta: MetaFunction<typeof loader> = ({
  data,
}) => {
  return [{ title: data.task.name }];
};
```

### `params`

The route's URL params. See [Dynamic Segments in the Routing Guide][url-params].

### `error`

Thrown errors that trigger error boundaries will be passed to the `meta` function. This is useful for generating metadata for error pages.

```tsx
export const meta: MetaFunction = ({ error }) => {
  return [{ title: error ? "oops!" : "Actual title" }];
};
```

## Accessing Data from Parent Route Loaders

In addition to the current route's data, often you'll want to access data from a route higher up in the route hierarchy. You can look it up by its route ID in [`matches`][matches].

```tsx filename=app/routes/project.$pid.tasks.$tid.tsx
import type { loader as projectDetailsLoader } from "./project.$pid";

export async function loader({
  params,
}: LoaderFunctionArgs) {
  return json({ task: await getTask(params.tid) });
}

export const meta: MetaFunction<
  typeof loader,
  { "routes/project.$pid": typeof projectDetailsLoader }
> = ({ data, matches }) => {
  const project = matches.find(
    (match) => match.id === "routes/project.$pid"
  ).data.project;
  const task = data.task;
  return [{ title: `${project.name}: ${task.name}` }];
};
```

## Gotchas with `meta` and Nested Routes

Because multiple nested routes render at the same time, there is some merging that needs to happen to determine the meta-tags that ultimately render. Remix gives you complete control over this merge because there is no obvious default.

Remix will take the last matching route with a `meta` export and use that. This allows you to override things like `title`, remove things like `og:image` that the parent route added, or keep everything from the parent and add new meta for the child route.

This can get quite tricky when you're new.

Consider a route like `/projects/123`, there are likely three matching routes: `app/root.tsx`, `app/routes/projects.tsx`, and `app/routes/projects.$id.tsx`. All three may export meta-descriptors.

```tsx bad filename=app/root.tsx
export const meta: MetaFunction = () => {
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
export const meta: MetaFunction = () => {
  return [{ title: "Projects" }];
};
```

```tsx bad filename=app/routes/projects.$id.tsx
export const meta: MetaFunction<typeof loader> = ({
  data,
}) => {
  return [{ title: data.project.name }];
};
```

With this code, we will lose the `viewport` meta tag at `/projects` and `/projects/123` because only the last meta is used and the code doesn't merge with the parent.

### Global `meta`

Nearly every app will have global meta like the `viewport` and `charSet`. We recommend using normal [`<meta>` tags][meta-element] inside the [root route][root-route] instead of the `meta` export, so you don't have to deal with merging:

```tsx filename=app/root.tsx lines=[12-16]
import {
  Links,
  Meta,
  Outlet,
  Scripts,
} from "@remix-run/react";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
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

### Avoid `meta` in Parent Routes

You can also avoid the merge problem by simply not exporting `meta` that you want to override from parent routes. Instead of defining `meta` on the parent route, use the [index route][index-route]. This way you can avoid complex merge logic for things like the title. Otherwise, you will need to find the parent title descriptor and replace it with the child's title. It's much easier to simply not need to override by using index routes.

### Merging with Parent `meta`

Usually you only need to add `meta` to what the parent has already defined. You can merge parent `meta` with the spread operator and the [`matches`][matches] argument:

```tsx
export const meta: MetaFunction = ({ matches }) => {
  const parentMeta = matches.flatMap(
    (match) => match.meta ?? []
  );
  return [...parentMeta, { title: "Projects" }];
};
```

Note that this _will not_ override something like `title`. This is only additive. If the inherited route meta includes a `title` tag, you can override with [`Array.prototype.filter`][array-filter]:

```tsx
export const meta: MetaFunction = ({ matches }) => {
  const parentMeta = matches
    .flatMap((match) => match.meta ?? [])
    .filter((meta) => !("title" in meta));
  return [...parentMeta, { title: "Projects" }];
};
```

### `meta` Merging helper

If you can't avoid the merge problem with global meta or index routes, we've created a helper that you can put in your app that can override and append to parent meta easily.

- [View Gist for `merge-meta.ts`][merge-meta]

[meta-element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta
[link-element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link
[links]: ./links
[use-matches]: ../hooks/use-matches
[merging-metadata-across-the-route-hierarchy]: #merging-with-parent-meta
[loader]: ./loader
[url-params]: ../file-conventions/routes#dynamic-segments
[matches]: #matches
[root-route]: ../file-conventions/root
[index-route]: ../discussion/routes#index-routes
[array-filter]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
[merge-meta]: https://gist.github.com/ryanflorence/ec1849c6d690cfbffcb408ecd633e069
