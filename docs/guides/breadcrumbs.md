---
title: Breadcrumbs Guide
---

# Breadcrumbs Guide

In Remix, you can easily build dynamic breadcrumbs based on your route hierarchy. This guide will take you through the process using the [`useMatches`][use-matches] and [`handle`][handle] features.

## Understanding the Basics

Remix provides access to all route matches and related data at the top of the React element tree. This enables components like [`<Meta />`][meta-component], [`<Links />`][links-component], and [`<Scripts />`][scripts-component] to obtain values from nested routes and render them at the top of the document.

You can use a similar strategy using the `useMatches` and `handle` functions. While we're focusing on breadcrumbs, the principles demonstrated here are applicable to a range of scenarios.

## Defining the Breadcrumbs for Routes

Start by adding a `breadcrumb` attribute to your route's `handle`. This attribute isn't specific to Remix – you can name it whatever you like. For our example, we'll call it `breadcrumb`.

```tsx filename=app/routes/parent.tsx
export const handle = {
  breadcrumb: () => <Link to="/parent">Some Route</Link>,
};
```

Similarly, you can define breadcrumbs for child routes:

```tsx filename=app/routes/parent.child.tsx
export const handle = {
  breadcrumb: () => (
    <Link to="/parent/child">Child Route</Link>
  ),
};
```

## Aggregating Breadcrumbs in the Root Route

Now, bring everything together in your root route using `useMatches`:

```tsx filename=app/root.tsx lines=[5,9,19-28]
import {
  Links,
  Scripts,
  useLoaderData,
  useMatches,
} from "@remix-run/react";

export default function Root() {
  const matches = useMatches();

  return (
    <html lang="en">
      <head>
        <Links />
      </head>
      <body>
        <header>
          <ol>
            {matches
              .filter(
                (match) =>
                  match.handle && match.handle.breadcrumb
              )
              .map((match, index) => (
                <li key={index}>
                  {match.handle.breadcrumb(match)}
                </li>
              ))}
          </ol>
        </header>
        <Outlet />
      </body>
    </html>
  );
}
```

Note that we pass the `match` object to breadcrumbs, allowing us to potentially utilize `match.data` for enhancing breadcrumb content based on the route's data. This example doesn't use it, but you'll likely want to use values from your loader data for the breadcrumb.

Using `useMatches` with `handle` offers a robust way for routes to contribute to rendering processes higher up the element tree than their actual render point.

## Additional Resources

- [`useMatches`][use-matches]
- [`handle`][handle]

[use-matches]: ../hooks/use-matches
[handle]: ../route/handle
[meta-component]: ../components/meta
[links-component]: ../components/links
[scripts-component]: ../components/scripts
