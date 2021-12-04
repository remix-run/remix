---
title: Conventions
order: 1
---

# Conventions

A lot of Remix APIs aren't imported from the `"remix"` package, but are instead conventions and exports from _your_ application modules. When you `import from "remix"`, _you are calling Remix_, but these APIs are when _Remix calls your code_.

## remix.config.js

This file has a few build and development configuration options, but does not actually run on your server.

```tsx filename=remix.config.js
module.exports = {
  appDirectory: "app",
  browserBuildDirectory: "public/build",
  devServerPort: 8002,
  publicPath: "/build/",
  serverBuildDirectory: "build",
  routes(defineRoutes) {
    return defineRoute(route => {
      route("/somewhere/cool/*", "catchall.tsx");
    });
  }
};
```

### appDirectory

The path to the `app` directory, relative to remix.config.js. Defaults to "app".

```js
// default
exports.appDirectory = "./app";

// custom
exports.appDirectory = "./elsewhere";
```

### routes

A function for defining custom routes, in addition to those already defined
using the filesystem convention in `app/routes`. Both sets of routes will be merged.

```tsx
exports.routes = async (defineRoutes) => {
  // If you need to do async work, do it before calling `defineRoutes`, we use
  // the call stack of `route` inside to set nesting.

  return defineRoutes((route) => {
    // A common use for this is catchall routes.
    // - The first argument is the React Router path to match against
    // - The second is the relative filename of the route handler
    route("/some/path/*", "catchall.tsx")

    // if you want to nest routes, use the optional callback argument
    route("some/:path", "some/route/file.js", () => {
      // - path is relative to parent path
      // - filenames are still relative to the app directory
      route("relative/path", "some/other/file")
    });

  }
}
```

### browserBuildDirectory

The path to the browser build, relative to remix.config.js. Defaults to "public/build". Should be deployed to static hosting.

### publicPath

The URL prefix of the browser build with a trailing slash. Defaults to "/build/". This is the path the browser will use to find assets.

### serverBuildDirectory

The path to the server build, relative to remix.config.js. Defaults to "build". This needs to be deployed to your server.

### devServerPort

The port number to use for the dev server. Defaults to 8002.

## File Name Conventions

There are a few conventions that Remix uses you should be aware of.

### Special Files

- **`remix.config.js`**: Remix uses this file to know how to build your app for production and run it in development. This file is required.
- **`app/entry.server.{js,jsx,ts,tsx}`**: This is your entry into the server rendering piece of Remix. This file is required.
- **`app/entry.client.{js,jsx,ts,tsx}`**: This is your entry into the browser rendering/hydration piece of Remix. This file is required.

### Route Filenames

- **`app/root.tsx`**: This is your root layout, or "root route" (very sorry for those of you who pronounce those words the same way!). It works just like all other routes: you can export a `loader`, `action`, etc.
- **`app/routes/*.{js,jsx,ts,tsx,md,mdx}`**: Any files in the `app/routes/` directory will become routes in your application. Remix supports all of those extensions.
- **`app/routes/{folder}/*.tsx`**: Folders inside of routes will create nested URLs.
- **`app/routes/{folder}` with `app/routes/{folder}.tsx`**: When a route has the same name as a folder, it becomes a "layout route" for the child routes inside the folder. Render an `<Outlet />` and the child routes will appear there. This is how you can have multiple levels of persistent layout nesting associated with URLs.
- **Dots in route filenames**: Adding a `.` in a route file will create a nested URL, but not a nested layout. Flat files are flat layouts, nested files are nested layouts. The `.` allows you to create nested URLs without needing to create a bunch of layouts. For example: `app/routes/some.long.url.tsx` will create the URL `/some/long/url`.
- **`app/routes/index.tsx`**: Routes named "index" will render when the parent layout route's path is matched exactly.
- **`$param`**: The dollar sign denotes a dynamic segment of the URL. It will be parsed and passed to your loaders and routes.

  For example: `app/routes/users/$userId.tsx` will match the following URLs: `users/123` and `users/abc` but not `users/123/abc` because that has too many segments. See the <Link to="../routing">routing guide</Link> for more information.

  Some CLIs require you to escape the \$ when creating files:

  ```bash
  touch routes/\$params.tsx
  ```

  Params can be nested routes, just create a folder with the `$` in it.

- **`app/routes/files/$.tsx`**: To add a "splat" path (some people call this a "catchall") name the file simply `$.tsx`. It will create a route path pattern like `files/*`. You can also use this along with dot file names: `app/routes/files.$.tsx`.

- **`app/routes/__some-layout/some-path.tsx`**: Prefixing a folder with `__` will create a "layout route". Layout routes are routes that don't add anything to the URL for matching, but do add nested components in the tree for layouts. Make sure to also have `__some-layout.tsx` as well. For example, all of your marketing pages could share a layout in the route tree with `app/routes/__marketing.tsx` as the layout and then all of the child routes go in `app/routes/__marketing/products.tsx` and `app/routes/__marketing/buy.tsx`. The `__marketing.tsx` route won't add any segments to the URL, but it will render when it's child routes match.

### Escaping special characters

Because some characters have special meaning, you must use our escaping syntax if you want those characters to actually appear in the route. For example, if I wanted to make a [Resource Route](../guides/resource-routes) for a `/sitemap.xml`, I could name the file `app/routes/[sitemap.xml].tsx`. So you simply wrap any part of the filename with brackets and that will escape any special characters.

<docs-info>
  Note, you could even do `app/routes/sitemap[.]xml.tsx` if you wanted to only wrap the part that needs to be escaped. It makes no difference. Choose the one you like best.
</docs-info>

## Entry Files

### entry.client.tsx

Remix uses `app/entry.client.tsx` as the entry point for the browser bundle. This module gives you full control over the "hydrate" step after JavaScript loads into the document.

Typically this module uses `ReactDOM.hydrate` to re-hydrate the markup that was already generated on the server in your [server entry module](../entry.server).

Here's a basic example:

```tsx
import ReactDOM from "react-dom";
import Remix from "@remix-run/react/browser";

ReactDOM.hydrate(<Remix />, document);
```

As you can see, you have full control over hydration. This is the first piece of code that runs in the browser. As you can see, you have full control here. You can initialize client-side libraries, setup things like `window.history.scrollRestoration`, etc.

### entry.server.tsx

Remix uses `app/entry.server.tsx` to generate the HTTP response when rendering on the server. The `default` export of this module is a function that lets you create the response, including HTTP status, headers, and HTML, giving you full control over the way the markup is generated and sent to the client.

This module should render the markup for the current page using a `<RemixServer>` element with the `context` and `url` for the current request. This markup will (optionally) be re-hydrated once JavaScript loads in the browser using the [browser entry module]("../entry.client").

You can also export an optional `handleDataRequest` function that will allow you to modify the response of a data request. These are the requests that do not render HTML, but rather return the loader and action data to the browser once client side hydration has occurred.

Here's a basic example:

```tsx
import ReactDOMServer from "react-dom/server";
import type {
  EntryContext,
  HandleDataRequestFunction
} from "remix";
import { RemixServer } from "remix";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const markup = ReactDOMServer.renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}

// this is an optional export
export const handleDataRequest: HandleDataRequestFunction =
  (
    response: Response,
    // same args that get passed to the action or loader that was called
    { request, params, context }
  ) => {
    response.headers.set("x-custom", "yay!");
    return response;
  };
```

## Route Module API

A route in Remix can be used for many things. Usually they’re used for the user interface of your app, like a React component with server-side lifecycle hooks. But they can also serve as generic routes for any kind of resource (like dynamic CSS or social images).

It's important to read [Route Module Constraints](../constraints/).

### `default` export

This is the component that will render when the route matches.

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

### `loader`

Each route can define a "loader" function that will be called on the server before rendering to provide data to the route.

```tsx
export const loader = async () => {
  return { ok: true };
};

// Typescript
import type { LoaderFunction } from "remix";
export const loader: LoaderFunction = async () => {
  return { ok: true };
};
```

This function is only ever run on the server. On the initial server render it will provide data to the HTML document. On navigations in the browser, Remix will call the function via [`fetch`][fetch]. This means you can talk directly to your database, use server only API secrets, etc. Any code that isn't used to render the UI will be removed from the browser bundle.

Using the database ORM Prisma as an example:

```tsx [1,4-6,9]
import { useLoaderData } from "remix";
import { prisma } from "../db";

export const loader = async () => {
  return prisma.user.findMany();
};

export default function Users() {
  const data = useLoaderData();
  return (
    <ul>
      {data.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

Because `prisma` is only used in the loader it will be removed from the browser bundle.

Remix polyfills the [Web Fetch API][fetch] on the server so you can use `fetch` inside of your loader as if you were in the browser.

#### loader `params`

Route params are passed to your loader. If you have a loader at `data/invoices/$invoiceId.tsx` then Remix will parse out the `invoiceId` and pass it to your loader. This is useful for fetching data from an API or database.

```js
// if the user visits /invoices/123
export const loader: LoaderFunction = ({ params }) => {
  params.invoiceId; // "123"
};
```

#### loader `request`

This is a [Fetch Request][request] instance with information about the request. You can read the MDN docs to see all of it's properties.

Most common cases are reading headers or the URL. You can also use this to read URL [URLSearchParams][urlsearchparams] from the request like so:

```tsx
export const loader: LoaderFunction = ({ request }) => {
  // read a cookie
  const cookie = request.headers.get("Cookie");

  // parse the search params
  const url = new URL(request.url);
  const search = url.searchParams.get("search");
};
```

#### loader `context`

This is the context you passed in to your server adapter's `getLoadContext()` function. It's a way to bridge the gap between the adapter's request/response API with your Remix app.

<docs-info>This API is an escape hatch, it’s uncommon to need it</docs-info>

Say your express server (or your serverless function handler) looks something like this:

```js filename=some-express-server.js
const {
  createRequestHandler
} = require("@remix-run/express");

app.all(
  "*",
  createRequestHandler({
    getLoadContext(req, res) {
      // this becomes the loader context
      return { expressUser: req.user };
    }
  })
);
```

And then your loader can access it.

```ts filename=routes/some-route.tsx
export const loader: LoaderFunction = ({ context }) => {
  const { expressUser } = context;
  // ...
};
```

#### Returning objects

You can return plain JavaScript objects from your loaders that will be made available to your [route modules]("../route-module").

```ts
export const loader = async () => {
  return { whatever: "you want" };
};
```

#### Returning Response Instances

When you return a plain object, Remix turns it into a [Fetch Response][response]. This means you can return them yourself, too.

```js
export const loader: LoaderFunction = async () => {
  const users = await db.users.findMany();
  const body = JSON.stringify(users);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json"
    }
  });
};
```

Remix provides helpers, like `json`, so you don't have to construct them yourself:

```tsx
import { json } from "remix";

export const loader: LoaderFunction = async () => {
  const users = await fakeDb.users.findMany();
  return json(users);
};
```

Between these two examples you can see how `json` just does a little of work to make your loader a lot cleaner. You usually want to use the `json` helper when you're adding headers or a status code to your response:

```tsx
import { json } from "remix";

export const loader: LoaderFunction = async ({
  params
}) => {
  const user = await fakeDb.project.findOne({
    where: { id: params.id }
  });

  if (!user) {
    return json("Project not found", { status: 404 });
  }

  return json(user);
};
```

See also:

- [`headers`](#headers)
- [MDN Response Docs][response]

#### Throwing Responses in Loaders

Along with returning responses, you can also throw Response objects from your loaders, allowing you to break through the call stack and show an alternate UI with contextual data through the `CatchBoundary`.

Here is a full example showing how you can create utility functions that throw responses to stop code execution in the loader and move over to an alternative UI.

```ts filename=app/db.ts
import { json } from "remix";
import type { ThrownResponse } from "remix";

export type InvoiceNotFoundResponse = ThrownResponse<
  404,
  string
>;

export function getInvoice(id, user) {
  const invoice = db.invoice.find({ where: { id } });
  if (invoice === null) {
    throw json("Not Found", { status: 404 });
  }
  return invoice;
}
```

```ts filename=app/http.ts
import { redirect } from "remix";
import { getSession } from "./session";

function requireUserSession(request) {
  const session = await getSession(
    request.headers.get("cookie")
  );
  if (!session) {
    // can throw our helpers like `redirect` and `json` because they
    // return responses.
    throw redirect("/login", 302);
  }
  return session.get("user");
}
```

```tsx filename=app/routes/invoice/$invoiceId.tsx
import { useCatch, useLoaderData } from "remix";
import type { ThrownResponse } from "remix";

import { requireUserSession } from "~/http";
import { getInvoice } from "~/db";
import type {
  Invoice,
  InvoiceNotFoundResponse
} from "~/db";

type InvoiceCatchData = {
  invoiceOwnerEmail: string;
};

type ThrownResponses =
  | InvoiceNotFoundResponse
  | ThrownResponse<401, InvoiceCatchData>;

export const loader = async ({ request, params }) => {
  const user = await requireUserSession(request);
  const invoice: Invoice = getInvoice(params.invoiceId);

  if (!invoice.userIds.includes(user.id)) {
    const data: InvoiceCatchData = {
      invoiceOwnerEmail: invoice.owner.email
    };
    throw new json(data, { status: 401 });
  }

  return invoice;
};

export default function InvoiceRoute() {
  const invoice = useLoaderData<Invoice>();
  return <InvoiceView invoice={invoice} />;
}

export function CatchBoundary() {
  // this returns { status, statusText, data }
  const caught = useCatch<ThrownResponses>();

  switch (caught.status) {
    case 401:
      return (
        <div>
          <p>You don't have access to this invoice.</p>
          <p>
            Contact {invoiceCatch.data.invoiceOwnerEmail} to
            get access
          </p>
        </div>
      );
    case 404:
      return <div>Invoice not found!</div>;
  }

  // You could also `throw new Error("Unknown status in catch boundary")`.
  // This will be caught by the closest `ErrorBoundary`.
  return (
    <div>
      Something went wrong: {invoiceCatch.status}{" "}
      {invoiceCatch.statusText}
    </div>
  );
}
```

### `action`

Like `loader`, action is a server only function to handle data mutations and other actions. If a non-GET request is made to your route (POST, PUT, PATCH, DELETE) then the action is called before the loaders.

Actions have the same API as loaders, the only difference is when they are called.

This enables you to co-locate everything about a data set in a single route module: the data read, the component that renders the data, and the data writes:

```tsx
import { redirect, Form } from "remix";
import { fakeGetTodos, fakeCreateTodo } from "~/utils/db";
import { TodoList } from "~/components/TodoList";

export async function loader() {
  return fakeGetTodos();
}

export async function action({ request }) {
  const body = await request.formData();
  const todo = await fakeCreateTodo({
    title: body.get("title")
  });
  return redirect(`/todos/${todo.id}`);
}

export default function Todos() {
  const data = useLoaderData();
  return (
    <div>
      <TodoList todos={data} />
      <Form method="post">
        <input type="text" name="title" />
        <button type="submit">Create Todo</button>
      </Form>
    </div>
  );
}
```

When a POST is made to a URL, multiple routes in your route hierarchy will match the URL. Unlike a GET to loaders, where all of them are called to build the UI, _only one action is called_.

<docs-info>The route called will be the deepest matching route, unless the deepest matching route is an "index route". In this case, it will post to the parent route of the index (because they share the same URL, the parent wins).</docs-info>

If you want to post to an index route use `?index` in the action: `<Form action="/accounts?index" method="post" />`

| action url        | route action               |
| ----------------- | -------------------------- |
| `/accounts?index` | `routes/accounts/index.js` |
| `/accounts`       | `routes/accounts.js`       |

Also note that forms without an action prop (`<Form method="post">`) will automatically post to the same route within which they are rendered, so using the `?index` param to disambiguate between parent and index routes is only useful if you're posting to an index route from somewhere besides the index route itself. If you're posting from the index route to itself, or from the parent route to itself, you don't need to define a `<Form action>` at all, just omit it: `<Form method="post">`.

See also:

- [`<Form>`][form]
- [`<Form action>`][form action]

### `headers`

Each route can define it's own HTTP headers. One of the common headers is the `Cache-Control` header that indicates to browser and CDN caches where and for how long a page is able to be cached.

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

Note: `loaderHeaders` is an instance of the [Web Fetch API][headers] `Headers` class.

Because Remix has nested routes, there's a battle of the headers to be won when nested routes match. In this case, the deepest route wins. Consider these files in the routes directory:

```
├── users.tsx
└── users
    ├── $userId.tsx
    └── $userId
        └── profile.tsx
```

If we are looking at `/users/123/profile` then three routes are rendering:

```tsx
<Users>
  <UserId>
    <Profile />
  </UserId>
</Users>
```

If all three define `headers`, the deepest module wins, in this case `profile.tsx`.

We don't want surprise headers in your responses, so it's your job to merge them if you'd like. Remix passes in the `parentHeaders` to your `headers` function. So `users.tsx` headers get passed to `$userId.tsx`, and then `$userId.tsx` headers are passed to `profile.tsx` headers.

That is all to say that Remix has given you a very large gun with which to shoot your foot. You need to be careful not to send a `Cache-Control` from a child route module that is more aggressive than a parent route. Here's some code that picks the least aggressive caching in these cases:

```tsx
import parseCacheControl from "parse-cache-control";

export function headers({ loaderHeaders, parentHeaders }) {
  const loaderCache = parseCacheControl(
    loaderHeaders.get("Cache-Control")
  );
  const parentCache = parseCacheControl(
    parentHeaders.get("Cache-Control")
  );

  // take the most conservative between the parent and loader, otherwise
  // we'll be too aggressive for one of them.
  const maxAge = Math.min(
    loaderCache["max-age"],
    parentCache["max-age"]
  );

  return {
    "Cache-Control": `max-age=${maxAge}`
  };
}
```

All that said, you can avoid this entire problem by _not defining headers in parent routes_ and only in leaf routes. Every layout that can be visited directly will likely have an "index route". If you only define headers on your leaf routes, not your parent routes, you will never have to worry about merging headers.

### `meta`

The meta export will set meta tags for your html document. We highly recommend setting the title and description on every route besides layout routes (their index route will set the meta).

```tsx
import type { MetaFunction } from "remix";

export const meta: MetaFunction = () => {
  return {
    title: "Something cool",
    description:
      "This becomes the nice preview on search results."
  };
};
```

There are a few special cases like `title` renders a `<title>` tag, `og:style` tags will render `<meta property content>`, the rest render `<meta name={key} content={value}/>`.

In the case of nested routes, the meta tags are merged automatically, so parent routes can add meta tags without the child routes needing to copy them.

### `links`

The links function defines which `<link>` elements to add to the page when the user visits a route.

```tsx
import type { LinksFunction } from "remix";

export const links: LinksFunction = () => {
  return [
    {
      rel: "icon",
      href: "/favicon.png",
      type: "image/png"
    },
    {
      rel: "stylesheet",
      href: "https://example.com/some/styles.css"
    },
    { page: "/users/123" },
    {
      rel: "preload",
      href: "/images/banner.jpg",
      as: "image"
    }
  ];
};
```

There are two types of link descriptors you can return:

#### `HtmlLinkDescriptor`

This is an object representation of a normal `<link {...props} />` element. [View the MDN docs for the link API][link-tag].

The `links` export from a route should return an array of `HtmlLinkDescriptor` objects.

Examples:

```tsx
import type { LinksFunction } from "remix";
import stylesHref from "../styles/something.css";

export const links: LinksFunction = () => {
  return [
    // add a favicon
    {
      rel: "icon",
      href: "/favicon.png",
      type: "image/png"
    },

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
    {
      rel: "prefetch",
      as: "image",
      href: "/img/bunny.jpg"
    },

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

#### HtmlMetaDescriptor

This is an object representation and abstraction of a `<meta {...props} />` element and its attributes. [View the MDN docs for the meta API](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta).

The `meta` export from a route should return a single `HtmlMetaDescriptor` object.

Almost every `meta` element takes a `name` and `content` attribute, with the exception of [OpenGraph tags](https://ogp.me/) which use `property` instead of `name`. In either case, the attributes represent a key/value pair for each tag. Each pair in the `HtmlMetaDescriptor` object represents a separate `meta` element, and Remix maps each to the correct attributes for that tag.

The `meta` object can also hold a `title` reference which maps to the [HTML `<title>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title)

Examples:

```tsx
import type { MetaFunction } from "remix";

export const meta: MetaFunction = () => {
  return {
    title: "Josie's Shake Shack", // <title>Josie's Shake Shack</title>
    description: "Delicious shakes", // <meta name="description" content="Delicious shakes">
    "og:image": "https://josiesshakeshack.com/logo.jpg" // <meta property="og:image" content="https://josiesshakeshack.com/logo.jpg">
  };
};
```

#### `PageLinkDescriptor`

These descriptors allow you to prefetch the resources for a page the user is likely to navigate to. While this API is useful, you might get more mileage out of `<Link prefetch="render">` instead. But if you'd like, you can get the same behavior with this API.

```js
export function links() {
  return [{ page: "/posts/public" }];
}
```

This loads up the JavaScript modules, loader data, and the stylesheets (defined in the `links` exports of the next routes) into the browser cache before the user even navigates there.

<docs-warning>Be careful with this feature. You don't want to download 10MB of JavaScript and data for pages the user probably won't ever visit.</docs-warning>

### CatchBoundary

A `CatchBoundary` is a React component that renders whenever an action or loader throws a `Response`.

**Note:** We use the word "catch" to represent the codepath taken when a `Response` type is thrown; you thought about bailing from the "happy path". This is different from an uncaught error you did not expect to occur.

A Remix `CatchBoundary` component works just like a route component, but instead of `useLoaderData` you have access to `useCatch`. When a response is thrown in an action or loader, the `CatchBoundary` will be rendered in it's place, nested inside parent routes.

A `CatchBoundary` component has access to the status code and thrown response data through `useCatch`.

```tsx
import { useCatch } from "remix";

export function CatchBoundary() {
  const caught = useCatch();

  return (
    <div>
      <h1>Caught</h1>
      <p>Status: {caught.status}</p>
      <pre>
        <code>{JSON.stringify(caught.data, null, 2)}</code>
      </pre>
    </div>
  );
}
```

### ErrorBoundary

An `ErrorBoundary` is a React component that renders whenever there is an error anywhere on the route, either during rendering or during data loading.

**Note:** We use the word "error" to mean an uncaught exception; something you didn't anticipate happening. This is different from other types of "errors" that you are able to recover from easily, for example a 404 error where you can still show something in the user interface to indicate you weren't able to find some data.

A Remix `ErrorBoundary` component works just like normal React [error boundaries](https://reactjs.org/docs/error-boundaries.html), but with a few extra capabilities. When there is an error in your route component, the `ErrorBoundary` will be rendered in its place, nested inside any parent routes. `ErrorBoundary` components also render when there is an error in the `loader` or `action` functions for a route, so all errors for that route may be handled in one spot.

An `ErrorBoundary` component receives one prop: the `error` that occurred.

```tsx
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

### handle

Exporting a handle allows you to create application conventions with the `useMatches()` hook. You can put whatever values you want on it:

```js
export const handle = {
  its: "all yours"
};
```

This is almost always used on conjunction with `useMatches`. To see what kinds of things you can do with it, refer to [`useMatches`](../remix/#usematches) for more information.

### unstable_shouldReload

<docs-warning>This API is unstable, we're confident in the use cases it solves but aren't sure about the API yet, it may change in the future.</docs-warning>

<docs-warning>This feature is an <i>additional</i> optimization. In general, Remix's design does a great job of only calling the loaders that the next page needs and ensuring your UI is in sync with your server. When you use this feature you risk your UI getting out of sync with your server. Use with caution!</docs-warning>

This function lets apps optimize which routes should be reloaded on some client-side transitions.

```ts
import type { ShouldReloadFunction } from "remix";

export const unstable_shouldReload: ShouldReloadFunction =
  ({
    // same params that go to `loader` and `action`
    params,

    // a possible form submission that caused this to be reloaded
    submission,

    // the next URL being used to render this page
    url,

    // the previous URL used to render this page
    prevUrl
  }) => false; // or `true`;
```

During client-side transitions, Remix will optimize reloading of routes that are already rendering, like not reloading layout routes that aren't changing. In other cases, like form submissions or search param changes, Remix doesn't know which routes need to be reloaded so it reloads them all to be safe. This ensures data mutations from the submission or changes in the search params are reflected across the entire page.

This function lets apps further optimize by returning `false` when Remix is about to reload a route. There are three cases when Remix will reload a route and you have the opportunity to optimize:

- if the `url.search` changes (while the `url.pathname` is the same)
- after actions are called
- "refresh" link clicks (click link to same URL)

Otherwise Remix will reload the route and you have no choice:

- A route matches the new URL that didn't match before
- The `url.pathname` changed (including route params)

Here are a couple of common use-cases:

#### Never reloading the root

It's common for root loaders to return data that never changes, like environment variables to be sent to the client app. In these cases you never need the root loader to be called again. For this case, you can simply `return false`.

```js [10]
export const loader = () => {
  return {
    ENV: {
      CLOUDINARY_ACCT: process.env.CLOUDINARY_ACCT,
      STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY
    }
  };
};

export const unstable_shouldReload = () => false;
```

With this in place, Remix will no longer make a request to your root loader for any reason, not after form submissions, not after search param changes, etc.

#### Ignoring search params

Another common case is when you've got nested routes and a child component has a feature that uses the search params in the URL, like a search page or some tabs with state you want to keep in the search params.

Consider these routes:

```
└── $projectId.tsx
    └── activity.tsx
```

And lets say the UI looks something like this:

```
┌──────────────────────────────┐
│    Project: Design Revamp    │
├────────┬─────────┬───────────┤
│  Tasks │ Collabs │ >ACTIVITY │
├────────┴─────────┴───────────┤
│  Search: _____________       │
│                              │
│  - Ryan added an image       │
│                              │
│  - Michael commented         │
│                              │
└──────────────────────────────┘
```

The `$activity.tsx` loader can use the search params to filter the list, so visiting a URL like `/projects/design-revamp/activity?search=image` could filter the list of results. Maybe it looks something like this:

```js [2,7]
export function loader({ request, params }) {
  const url = new URL(request.url);
  return exampleDb.activity.findAll({
    where: {
      projectId: params.projectId,
      name: {
        contains: url.searchParams.get("search")
      }
    }
  });
}
```

This is great for the activity route, but Remix doesn't know if the parent loader, `$projectId.tsx` _also_ cares about the search params. That's why Remix does the safest thing and reloads all the routes on the page when the search params change.

In this UI, that's wasted bandwidth for the user, your server, and your database because `$projectId.tsx` doesn't use the search params. Consider that our loader for `$projectId.tsx` looks something like this:

```tsx
export function loader({ params }) {
  return fakedb.findProject(params.projectId);
}
```

We want this loader to be called only if the project has had an update, so we can make this really simple and just say to reload if there is a non-GET submission:

```tsx
export function unstable_shouldReload({ submission }) {
  return submission && submission.method !== "GET";
}
```

Now if the child route causes the search params to change, this route will no longer be reloaded because there was no submission.

<docs-info>When you want to optimize a loader, instead of thinking about the thing causing the reload (search params), think only about the loader's requirements that you're optimizing.</docs-info>

You may want to get more granular and reload only for submissions to this project:

```tsx
export function unstable_shouldReload({
  params,
  submission
}) {
  return (
    submission &&
    submission.action === `/projects/${params.projectId}`
  );
}
```

You need to be very careful here, though. That project (or its nested relationships) may be updated by other actions and your app will get out of sync if you don't also consider them.

## Asset URL Imports

Any files inside the `app` folder can be imported into your modules. Remix will:

1. Copy the file to your browser build directory
2. Fingerprint the file for long-term caching
3. Return the public URL to your module to be used while rendering

It's most common for stylesheets, but can used for anything.

```tsx
// root.tsx
import type { LinksFunction } from "remix";
import styles from "./styles/app.css";
import banner from "./images/banner.jpg";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};

export default function Page() {
  return (
    <div>
      <h1>Some Page</h1>
      <img src={banner} />
    </div>
  );
}
```

[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[request]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[response]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[headers]: https://developer.mozilla.org/en-US/docs/Web/API/Headers
[urlsearchparams]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
[form]: ../remix/#form
[form action]: ../remix/#form-action
[link tag]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link
