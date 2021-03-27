---
title: Route Module
---

A route in Remix is mostly a React component, with a couple extra exports.

## Component

The only required export of a route module is a React component. When the URL matches, the component will be rendered.

```tsx
export default function SomeRouteComponent() {
  return (
    <div>
      <h1>Look ma!</h1>
      <p>I'm still using React after like 7 years.</p>
    </div>
  );
}
```

## loader

Each route can define a loader function that will be called before rendering to provide data to the route.

```tsx
export let loader = () => {
  return fetch("https://example.com/api/stuff");
};
```

This function is only ever run on the server. On the initial server render it will be called and provide data to the HTML document. On navigations in the browser, Remix will call the function via `fetch`. This means you can talk directly to your database, use server only API secrets, etc. Any code that isn't used to render the UI will be removed from the browser bundle.

Using the database ORM Prisma as an example:

```tsx
import { PrismaClient } from "@prisma/client";

let prisma = new PrismaClient();

export let loader = () => {
  return await prisma.user.findMany();
};

export default function Users() {
  let data = useRouteData();
  return (
    <ul>
      {data.map(user => (
        <li>{user.name}</li>
      ))}
    </ul>
  );
}
```

Because `prisma` isn't used in the default component export it will be removed from the browser bundle. And because nothing is using `PrismaClient` anymore, the entire dependency is removed from the browser bundle.

### Loader arg: params

Route params are passed to your loader. If you have a loader at `data/invoices/$invoiceId.js` then Remix will parse out the `invoiceId` and pass it to your loader. This is useful for fetching data from an API or database.

```js
// if the user visits /invoices/123
export let loader: Loader = ({ params }) => {
  params.invoiceId; // "123"
};
```

### Loader arg: request

This is a [Web API Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) instance with information about the request. You can read the MDN docs to see all of it's properties.

You can also use this to read URL [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) from the request like so:

```js
// say the user is at /some/route?foo=bar
export let loader: Loader = ({ request }) => {
  let url = new URL(request.url);
  let foo = url.searchParams.get("foo");
};
```

### Loader arg: context

This is the context you passed in to your deployment wrapper's `getLoaderContext()` function. It's a way to bridge the gap between the platform's request/response API with your remix app.

Say your express server (or your serverless function handler) looks something like this:

```js
const { createRequestHandler } = require("@remix-run/express");

app.all(
  "*",
  createRequestHandler({
    getLoaderContext(req, res) {
      // this becomes the loader context
      return { req, res };
    }
  })
);
```

And then your loader can access it.

```ts
// data/some-loader.js
export let loader: Loader = ({ context }) => {
  let { req } = context.req;
  // read a cookie
  req.cookies.session;
};
```

### Returning objects

You can return plain JavaScript objects from your loaders that will be made available to your [route modules]("../route-module").

```ts
// some fake database, not part of remix
let db = require("../db");

export let loader = async () => {
  let users = await db.query("users");
  return users;
};
```

### Returning Response Instances

You can return Web API Response objects from your loaders. Here's a pretty basic JSON response:

```js
// some fake database, not part of remix
import db from "../db";

export let loader: Loader = async () => {
  let users = await db.query("users");

  let body = JSON.stringify(users);

  return new Response(body, {
    headers: {
      "Content-Type": "application/json"
    }
  });
};
```

Normally you'd use the `json` helper from your [environment](../environments).

```js
import db from "../db";
import { json } from "@remix-run/data";

export let loader: Loader = async () => {
  let users = await db.query("users");
  return json(users);
};
```

Between these two examples you can see how `json` just does a little of work to make your loader a lot cleaner.

See also:

- (Remix Web Fetch API)["../other/fetch"]
- [MDN Response Docs](https://developer.mozilla.org/en-US/docs/Web/API/Response)

### Response Status Codes in Loaders

Loaders can return Responses with status codes. This is very useful for "not found" data making it's way all the way down to the browser's UI with a real 404 status code, 500s, etc.

```js [6]
import { json } from "@remix-run/data";

export let loader = async () => {
  let res = db.query("users").where("id", "=", "_why");
  if (res === null) {
    return json({ notFound: true }, { status: 404 });
  } else {
    return res;
  }
};
```

This is also useful for 500 error handling. You don't need to render a different page, instead, handle the error, send the data, and send a 500 response to the app.

```js [6-12]
export let loader: Loader = async () => {
  try {
    let stuff = await something();
    return json(stuff);
  } catch (error) {
    return json(
      {
        error: true,
        message: error.message
      },
      { status: 500 }
    );
  }
};
```

Now your route component can deal with it:

```tsx
export default function Something() {
  let data = useRouteData();

  if (data.error) {
    return <ErrorMessage>{data.message}</ErrorMessage>;
  }

  // ...
}
```

The initial server render will get a 500 for this page, and client side transitions will get it also.

## action

Like `loader`, action is a server only function to handle data mutations and other actions. If a non-GET request is made to your route (POST, PUT, PATCH, DELETE) then the route's action is called instead of its loader.

Actions are triggered from `<form method="post">` or Remix `<Form method="post | put | patch | delete" />` submits. Note you must always `redirect` (we do this so users can't click "back" and accidentally resubmit the form).

```tsx
import { redirect } from "@remix-run/data";
import { PrismaClient } from "@prisma/client";

let prisma = new PrismaClient();

export let action = async ({ params, request }) => {
  let data = new URLSearchParams(await request.text());

  let update = await prisma.post.update({
    where: { id: params.postId },
    data: Object.fromEntries(data)
  });

  return redirect(`/posts/${params.postId}`);
};
```

## headers

Each route can define it's own HTTP headers. One of the most important headers is the `Cache-Control` header that indicates to browser and CDN caches where and for how long a page is able to be cached.

```tsx
export function headers({ loaderHeaders, parentHeaders }) {
  return {
    "X-Stretchy-Pants": "its for fun",
    "Cache-Control": "max-age=300, s-maxage=3600"
  };
}
```

Usually your data is a better indicator of your cache duration than your route module (data tends to be more dynamic than markup), so the loader's headers are passed in to `headers()` too:

```tsx
export function headers({ loaderHeaders }) {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control")
  };
}
```

Note: `loaderHeaders` is an instance of the [Web Fetch API]("../fetch") `Headers` class.

Because Remix has nested routes, there's a battle of the headers to be won when nested routes match. In this case, the deepest route wins. Consider these files in the routes directory:

```
├── users.js
└── users
    ├── $userId.js
    └── $userId
        └── profile.js
```

If we are looking at `/users/123/profile` then three routes are rendering:

```tsx
<Users>
  <UserId>
    <Profile />
  </UserId>
</Users>
```

If all three define `headers`, the deepest module wins, in this case `profile.js`.

We don't want surprise headers in your responses, so it's your job to merge them if you'd like. Remix passes in the `parentHeaders` to your `headers` function. So `users.js` headers get passed to `$userId.js`, and then `$userId.js` headers are passed to `profile.js` headers.

That is all to say that Remix has given you a very large gun with which to shoot your foot. You need to be careful not to send a `Cache-Control` from a child route module that is more aggressive than a parent route. Here's some code that picks the least aggressive caching in these cases:

```tsx
import parseCacheControl from "parse-cache-control";

export function headers({ loaderHeaders, parentHeaders }) {
  let loaderCache = parseCacheControl(loaderHeaders.get("Cache-Control"));
  let parentCache = parseCacheControl(parentHeaders.get("Cache-Control"));

  // take the most conservative between the parent and loader, otherwise
  // we'll be too aggressive for one of them.
  let maxAge = Math.min(loaderCache["max-age"], parentCache["max-age"]);

  return {
    "Cache-Control": `max-age=${maxAge}`
  };
}
```

All that said, you can avoid this entire problem by _not defining headers in layout routes_ and only in leaf routes. Every layout that can be visited directly will likely have an "index route". If you only define headers on your leaf routes, not your layout routes, you will never have to worry about merging headers.

## meta

The meta export will set meta tags for your html document. We highly recommend setting the title and description on every route besides layout routes (their index route will set the meta).

```tsx
import type { MetaFunction } from "@remix-run/data";

export let meta: MetaFunction = () => {
  return {
    title: "Something cool",
    description: "This becomes the nice preview on search results."
  };
};
```

Title is a special case and will render a `<title>` tag, the rest render `<meta name={key} content={value}/>`.

In the case of nested routes, the meta tags are merged, so parent routes can add meta tags with the child routes needing to copy them.

## links

The links function defines which `<link>` elements to add to the page when the user visits a page.

```tsx
import type { LinksFunction } from "@remix-run/react";
import { block } from "@remix-run/react";

export let links: MetaFunction = () => {
  return [
    { rel: "icon", href: "/favicon.png", type: "image/png" },
    { rel: "stylesheet", href: "https://example.com/some/styles.css" },
    { page: "/users/123" },
    block({ rel: "preload", href: "/images/banner.jpg", as: "image" })
  ];
};
```

There are three types of link descriptors you can return:

### HTMLLinkDescriptor

This is an object representation of a normal `<link {...props} />` element. [View the MDN docs for the link API](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link).

Examples:

```tsx
import type { LinksFunction } from "@remix-run/react";
import { block } from "@remix-run/react";
import stylesHref from "url:../styles/something.css";

export let links: LinksFunction = () => {
  return [
    // add a favicon
    { rel: "icon", href: "/favicon.png", type: "image/png" },

    // add an external stylesheet
    {
      rel: "stylesheet",
      href: "https://example.com/some/styles.css",
      crossOrigin: "true"
    },

    // add a local stylesheet, remix will fingerprint the file name for
    // production caching
    { rel: "stylesheet", href: stylesHref },

    // prefetch an image into the browser cache that the user is likely to see
    // as they interact with this page, perhaps they click a button to reveal in
    // a summary/details element
    { rel: "prefetch", as: "image", href: "/img/bunny.jpg" },

    // only prefetch it if they're on a bigger screen
    {
      rel: "prefetch",
      as: "image",
      href: "/img/bunny.jpg",
      media: "(min-width: 1000px)"
    }
  ];
};
```

### BlockLinkDescriptor

You can block `{ rel: "preload" }` HTMLLinkDescriptors on client side page transitions by wrapping them in `block(descriptor)`.

```tsx
import type { LinksFunction } from "@remix-run/react";
import { block } from "@remix-run/react";

export let links: LinksFunction = () => {
  return [
    block({
      rel: "preload",
      as: "image",
      href: "/img/bunny.jpg"
    })
  ];
};
```

When the user clicks a link to this page, the transition will not complete until the image has loaded into the browser cache. This can help prevent layout shift as the user navigates around.

**Note**: The image will not be fully loaded if the user's initial visit to the website is this page. There's no way for Remix to do that.

**Be careful with this API**: Waiting on images or other assets will drastically slow down the transition from one route to another. Use this feature with discretion.

### PageLinkDescriptor

These descriptors allow you to prefetch the resources for a page the user is _likely_ to navigate to. What do we mean by likely? Some examples:

- User is on the login page, it's likely they'll end up at the dashboard after a successful login attempt, so it's a good idea to prefetch the resources for the dashboard.
- User is on the shopping cart page, it's likely they'll end up on the checkout page next.
- User is on an index page of a list of invoices, it's likely they'll end up on an invoice page.

Let's take the login → dashboard example:

```js
import type { LinksFunction } from "@remix-run/react";

export let links: LinksFunction = () => {
  return [{ page: "/dashboard" }];
};
```

You can prefetch the data for the next page with the `data` boolean:

```ts
{ page: "/users/123", data: true }
```

**Be careful with this feature**. You don't want to download 10MB of JavaScript and data for pages the user probably won't ever visit.

## ErrorBoundary

An `ErrorBoundary` is a React component that renders whenever there is an error anywhere on the route, either during rendering or during data loading.

**Note:** We use the word "error" to mean an uncaught exception; something you didn't anticipate happening. This is different from other types of "errors" that you are able to recover from easily, for example a 404 error where you can still show something in the user interface to indicate you weren't able to find some data.

A Remix `ErrorBoundary` component works just like normal React [error boundaries](https://reactjs.org/docs/error-boundaries.html), but with a few extra capabilities. When there is an error in your route component, the `ErrorBoundary` will be rendered in its place, nested inside any parent routes. `ErrorBoundary` components also render when there is an error in the `loader` or `action` functions for a route, so all errors for that route may be handled in one spot.

An `ErrorBoundary` component receives one prop: the `error` that occurred.

```ts
export function ErrorBoundary({ error }) {
  return (
    <div>
      <h1>Error</h1>
      <p>{error.message}</p>
      <p>The stack trace is:</p>
      <pre>{error.stack}</pre>
    </div>
  );
}
```

## handle

Exporting a handle allows you to create application conventions with the `useMatches()` hook. You can put whatever values you want on it:

```js
export let handle = {
  its: "all yours"
};
```

Please refer to the [`useMatches` documentation](/dashboard/docs/react#usematches) for more information.
