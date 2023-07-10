---
title: Routing
description: Routing is at the center of everything Remix does. Dive deeper into the APIs and conventions.
---

# Routing

Routing is possibly the most important concept to understand in Remix. Everything starts with your routes: the compiler, the initial request, and almost every user interaction afterward.

Here's some vocabulary this document will be using regularly. They may not all make sense to you at first, but as you read the document they are here for your reference.

<docs-info>

**Nested Routes** - The general idea of routes mapping to segments of the URL allowing the full URL to map to a hierarchy of route components and data dependencies that can be known before rendering.

**URL** - The full path in the address bar of the user's web browser. A single URL can match multiple routes. It's common in other frameworks to use the words "route" and "url" interchangeably, but they are different things in Remix.

**Route** or Route Module - A JavaScript module with conventional exports (`loader`, `action`, `default` component, etc.) that is coupled to one or many URL segments. Because a Route module maps to only a segment of the URL, multiple routes can be rendered at a single URL. The component hierarchy will map to the URL segment hierarchy.

**Path** or Route Path - The segment of the URL an individual route maps to, defined by the conventional file name in the `app/routes` directory.

**Parent Layout Route** or Parent Route - A route that renders its component as the layout above a set of child routes through `<Outlet>`.

**Pathless Layout Route** or Pathless Route - A route that does not add segments to the URL but does add component layout hierarchy when its child routes match.

**Child Route** - A route that renders inside a parent route's `<Outlet>` when its path matches the URL.

**Index Route** - A route that shares the same URL as the parent route but renders as the default child route inside of `<Outlet>`.

**Dynamic Segment** - A segment of the route path that is parsed from the URL and its value provided to the app, like the ID of a record or slug for a post.

**Splat** - A trailing wildcard on a route path that will match anything (including subsequent `/`) and provided to the app.

**Outlet** - A component rendered inside a parent route that shows where to render the matching child route

</docs-info>

## What is Nested Routing?

Nested Routing is the general idea of coupling segments of the URL to component hierarchy in the UI. We've found that in almost every case, segments of the URL determine:

- The layouts to render on the page
- The code-split JavaScript bundles to load
- The data dependencies of those layouts

Let's consider a UI to help us out. Hover or tap each button to see how each segment of the URL maps to three things: a component layout, a JavaScript bundle, and a piece of data.

<iframe src="/_docs/routing" class="w-full aspect-[1/1] rounded-lg overflow-hidden"></iframe>

As the user clicks between links in the sidebar, the sidebar persists while the main content changes. Likewise, as they click between the Sales page top nav (Overview, Subscriptions, Invoices, etc.) both the sidebar and the top nav persist while the secondary content changes, and so on down the layout hierarchy.

In Remix, all of these "boxes" are a **Route**, defined by a **Route Module** in your app.

## Defining Routes

The primary way to define a route is to create a new file in `app/routes/*`. The routes for the UI example above would look something like this:

```
app
├── root.tsx
└── routes
    ├── _index.tsx
    ├── accounts.tsx
    ├── dashboard.tsx
    ├── expenses.tsx
    ├── reports.tsx
    ├── sales._index.tsx
    ├── sales.customers.tsx
    ├── sales.deposits.tsx
    ├── sales.invoices.$invoiceId._index.tsx
    ├── sales.invoices.$invoiceId.tsx
    ├── sales.invoices.tsx
    ├── sales.subscriptions.tsx
    └── sales.tsx
```

<details>

<summary>Or if using the v1 routing convention:</summary>

```
app
├── root.tsx
└── routes
    ├── accounts.tsx
    ├── dashboard.tsx
    ├── expenses.tsx
    ├── index.tsx
    ├── reports.tsx
    ├── sales
    │   ├── customers.tsx
    │   ├── deposits.tsx
    │   ├── index.tsx
    │   ├── invoices
    │   │   ├── $invoiceId.tsx
    │   │   └── index.tsx
    │   ├── invoices.tsx
    │   └── subscriptions.tsx
    └── sales.tsx
```

</details>

- `root.tsx` is the "root route" that serves as the layout for the entire application. Every route will render inside its `<Outlet/>`.
- Note that there are files with `.` delimiters. The `.` creates a `/` in the URL for that route, as well as layout nesting with another route that matches the segments before the `.`. For example, `sales.tsx` is the **parent route** for all the **child routes** that look like `sales.[the nested path].tsx`. The `<Outlet />` in `sales.tsx` will render the matching child route.
- The `_index.tsx` routes will render inside the parent `<Outlet>` when the url is only as deep as the parent's path (like `example.com/sales` instead of `example.com/sales/customers`)

## Rendering Route Layout Hierarchies

Let's consider the URL is `/sales/invoices/102000`. The following routes all match that URL:

- `root.tsx`
- `routes/sales.tsx`
- `routes/sales.invoices.tsx`
- `routes/sales.invoices.$invoiceId.tsx`

When the user visits this page, Remix will render the components in this hierarchy:

```tsx
<Root>
  <Sales>
    <Invoices>
      <InvoiceId />
    </Invoices>
  </Sales>
</Root>
```

You'll note that the component hierarchy is perfectly mapped to the file system hierarchy in `routes`. By looking at the files, you can anticipate how they will render.

```
app
├── root.tsx
└── routes
    ├── sales.invoices.$invoiceId.tsx
    ├── sales.invoices.tsx
    └── sales.tsx
```

If the URL is `/accounts`, the UI hierarchy changes to this:

```tsx
<Root>
  <Accounts />
</Root>
```

It's partly your job to make this work. You need to render an `<Outlet/>` to continue the rendering of the route hierarchy from the parent routes. `root.tsx` renders the main layout, sidebar, and then an outlet for the child routes to continue rendering through:

```tsx filename=app/root.tsx lines=[1,7]
import { Outlet } from "@remix-run/react";

export default function Root() {
  return (
    <Document>
      <Sidebar />
      <Outlet />
    </Document>
  );
}
```

Next up is the sales route, which also renders an outlet for its child routes (all the routes matching `app/routes/sales.*.tsx`).

```tsx filename=app/routes/sales.tsx lines=[8]
import { Outlet } from "@remix-run/react";

export default function Sales() {
  return (
    <div>
      <h1>Sales</h1>
      <SalesNav />
      <Outlet />
    </div>
  );
}
```

And so on down the route tree. This is a powerful abstraction that makes something previously complex very simple.

## Index Routes

Index routes are often difficult to understand at first. It's easiest to think of them as _the default child route_ for a parent route. When there is no child route to render, we render the index route.

Consider the URL `example.com/sales`. If our app didn't have an index route at `app/routes/sales._index.tsx` the UI would look like this!

<iframe src="/_docs/routing-index" class="w-full aspect-[4/3] rounded-lg overflow-hidden mb-4"></iframe>

And index is the thing you render to fill in that empty space when none of the child routes match.

<docs-error>Index Routes cannot have child routes</docs-error>

Index routes are "leaf routes". They're the end of the line. If you think you need to add child routes to an index route, that usually means your layout code (like a shared nav) needs to move out of the index route and into the parent route.

This usually comes up when folks are just getting started with Remix and put their global nav in `app/routes/_index.tsx`. Move that global nav up into `app/root.tsx`. Everything inside of `app/routes/*` is already a child of `root.tsx`.

### What is the `?index` query param?

You may notice an `?index` query parameter showing up on your URLs from time to time, particularly when you are submitting a `<Form>` from an index route. This is required to differentiate index routes from their parent layout routes. Consider the following structure, where a URL such as `/sales/invoices` would be ambiguous. Is that referring to the `routes/sales.invoices.tsx` file? Or is it referring to the `routes/sales.invoices._index.tsx` file? In order to avoid this ambiguity, Remix uses the `?index` parameter to indicate when a URL refers to the index route instead of the layout route.

```
└── app
    ├── root.tsx
    └── routes
        ├── sales.invoices._index.tsx   <-- /sales/invoices?index
        └── sales.invoices.tsx <-- /sales/invoices
```

This is handled automatically for you when you submit from a `<Form>` contained within either the layout route or the index route. But if you are submitting forms to different routes, or using `fetcher.submit`/`fetcher.load` you may need to be aware of this URL pattern, so you can target the correct route.

## Nested URLs without nesting layouts

Sometimes you want to add nesting to the URL (slashes) but you don't want to create UI hierarchy. Consider an edit page for an invoice:

- We want the URL to be `/sales/invoices/:invoiceId/edit`
- We **don't** want it nested inside the components except the root so the user (and our designer) has plenty of room to edit the invoice

In other words, we don't want this:

```tsx bad
<Root>
  <Sales>
    <Invoices>
      <InvoiceId>
        <EditInvoice />
      </InvoiceId>
    </Invoices>
  </Sales>
</Root>
```

We want this:

```tsx
<Root>
  <EditInvoice />
</Root>
```

So, if we want a flat UI hierarchy, we use a `trailing_` underscore to opt-out of layout nesting. This defines URL nesting _without creating component nesting_.

```
└── app
    ├── root.tsx
    └── routes
        ├── sales.invoices.$invoiceId.tsx
        ├── sales.invoices.tsx
        ├── sales_.invoices.$invoiceId.edit.tsx 👈 not nested
        └── sales.tsx
```

So if the url is "example.com/sales/invoices/2000/edit", we'll get this UI hierarchy that matches the file system hierarchy:

```tsx
<Root>
  <EditInvoice />
</Root>
```

If we remove "edit" from the URL like this: "example.com/sales/invoices/2000", then we get all the hierarchy again:

```tsx
<Root>
  <Sales>
    <Invoices>
      <InvoiceId />
    </Invoices>
  </Sales>
</Root>
```

- Layout Nesting + Nested URLs: happens automatically with `.` delimiters that match parent route names.
- `trailing_` underscore on the segment matching the parent route opts-out of layout nesting.

You can introduce nesting or non-nesting at any level of your routes, like `app/routes/invoices.$id_.edit.js`, which matches the URL `/invoices/123/edit` but does not create nesting inside of `$id.js`, it would nest with `routes/invoices.tsx` instead.

## Pathless Layout Routes

Now for the inverse use case, sometimes you want to share a layout for a set of routes, _but you don't want to add any segments to the URL_. You can do this with a **pathless layout route**.

Consider we want to add some authentication routes, with a UI hierarchy like this:

```tsx
<Root>
  <Auth>
    <Login />
  </Auth>
</Root>
```

At first, you might think to just create an `auth` parent route and put the child routes inside to get the layout nesting:

```
app
├── root.tsx
└── routes
    ├── auth.login.tsx
    ├── auth.logout.tsx
    ├── auth.signup.tsx
    └── auth.tsx
```

We have the right UI hierarchy, but we probably don't actually want each of the URLs to be prefixed with `/auth` like `/auth/login`. We just want `/login`.

You can remove the URL nesting, but keep the UI nesting, by adding an underscore to the auth route segment:

```
app
├── root.tsx
└── routes
    ├── _auth.login.tsx
    ├── _auth.logout.tsx
    ├── _auth.signup.tsx
    └── _auth.tsx
```

Now when the URL matches `/login` the UI hierarchy will be same as before.

<docs-info>

- `_leading` underscore opts-out of URL nesting
- `trailing_` underscore opts-out of layout nesting

</docs-info>

## Dynamic Segments

Prefixing a file name with `$` will make that route path a **dynamic segment**. This means Remix will match any value in the URL for that segment and provide it to your app.

For example, the `$invoiceId.tsx` route. When the url is `/sales/invoices/102000`, Remix will provide the string value `102000` to your loaders, actions, and components by the same name as the filename segment:

```tsx
import { useParams } from "@remix-run/react";

export async function loader({ params }: LoaderArgs) {
  const id = params.invoiceId;
}

export async function action({ params }: ActionArgs) {
  const id = params.invoiceId;
}

export default function Invoice() {
  const params = useParams();
  const id = params.invoiceId;
}
```

Route can have multiple params, and params can be folders as well.

```
app
├── root.tsx
└── routes
    ├── projects.$projectId.tsx
    ├── projects.$projectId.$taskId.tsx
    └── projects.tsx
```

If the URL is `/projects/123/abc` then the params will be as follows:

```tsx
params.projectId; // "123"
params.taskId; // "abc"
```

## Splats

Naming a file `$.tsx` will make that route path a **splat route**. This means Remix will match any value in the URL for rest of the URL to the end. Unlike **dynamic segments**, a splat won't stop matching at the next `/`, it will capture everything.

Consider the following routes:

```
app
├── root.tsx
└── routes
    ├── files.$.tsx
    ├── files.mine.tsx
    ├── files.recent.tsx
    └── files.tsx
```

When the URL is `example.com/files/images/work/flyer.jpg`. The splat param will capture the trailing segments of the URL and be available to your app on `params["*"]`

```tsx
export async function loader({ params }: LoaderArgs) {
  params["*"]; // "images/work/flyer.jpg"
}
```

You can add splats at any level of your route hierarchy. Any sibling routes will match first (like `/files/mine`).

It's common to add a `routes/$.tsx` file build custom 404 pages with data from a loader (without it, Remix renders your root `ErrorBoundary` with no ability to load data for the page when the URL doesn't match any routes).

## Conclusion

Nested routes are an incredibly powerful abstraction. Layouts are shared automatically and each route is only concerned with its slice of the data on the page. Additionally, because of this convention, Remix is able to make a ton of optimizations, automatically turning what feels like a server side app from the developer's perspective into a turbocharged SPA for the user.

Happy routing!
