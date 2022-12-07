---
title: Conventions
order: 1
---

# Conventions

A lot of Remix APIs aren't imported from the `"@remix-run/*"` packages, but are instead conventions and exports from _your_ application modules. When you `import from "@remix-run/*"`, _you are calling Remix_, but these APIs are consumed when _Remix calls your code_.

## remix.config.js

This file has a few build and development configuration options, but does not actually run on your server.

```tsx filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  ignoredRouteFiles: ["**/.*"],
  publicPath: "/build/",
  routes(defineRoutes) {
    return defineRoutes((route) => {
      route("/somewhere/cool/*", "catchall.tsx");
    });
  },
  serverBuildPath: "build/index.js",
  serverBuildTarget: "node-cjs",
};
```

### appDirectory

The path to the `app` directory, relative to remix.config.js. Defaults to
`"app"`.

```js
// default
exports.appDirectory = "./app";

// custom
exports.appDirectory = "./elsewhere";
```

### assetsBuildDirectory

The path to the browser build, relative to remix.config.js. Defaults to
"public/build". Should be deployed to static hosting.

### cacheDirectory

The path to a directory Remix can use for caching things in development,
relative to `remix.config.js`. Defaults to `".cache"`.

### devServerBroadcastDelay

The delay, in milliseconds, before the dev server broadcasts a reload event.
There is no delay by default.

### devServerPort

The port number to use for the dev websocket server. Defaults to 8002.

### ignoredRouteFiles

This is an array of globs (via [minimatch][minimatch]) that Remix will match to
files while reading your `app/routes` directory. If a file matches, it will be
ignored rather than treated like a route module. This is useful for ignoring
dotfiles (like `.DS_Store` files) or CSS/test files you wish to colocate.

### publicPath

The URL prefix of the browser build with a trailing slash. Defaults to
`"/build/"`. This is the path the browser will use to find assets.

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
    route("/some/path/*", "catchall.tsx");

    // if you want to nest routes, use the optional callback argument
    route("some/:path", "some/route/file.js", () => {
      // - path is relative to parent path
      // - filenames are still relative to the app directory
      route("relative/path", "some/other/file");
    });
  });
};
```

### server

A server entrypoint, relative to the root directory that becomes your server's
main module. If specified, Remix will compile this file along with your
application into a single file to be deployed to your server. This file can use
either a `.js` or `.ts` file extension.

### serverBuildDirectory

<docs-warning>This option is deprecated and will likely be removed in a future
stable release. Use [`serverBuildPath`][server-build-path] instead.</docs-warning>

The path to the server build, relative to `remix.config.js`. Defaults to
"build". This needs to be deployed to your server.

### serverBuildPath

The path to the server build file, relative to `remix.config.js`. This file
should end in a `.js` extension and should be deployed to your server.

If omitted, the default build path will be based on your
[`serverBuildTarget`][server-build-target].

### serverBuildTarget

The target of the server build. Defaults to `"node-cjs"`.

The `serverBuildTarget` can be one of the following:

- [`"arc"`][arc]
- [`"cloudflare-pages"`][cloudflare-pages]
- [`"cloudflare-workers"`][cloudflare-workers]
- [`"deno"`][deno]
- [`"netlify"`][netlify]
- [`"node-cjs"`][node-cjs]
- [`"vercel"`][vercel]

### serverDependenciesToBundle

A list of regex patterns that determines if a module is transpiled and included in the server bundle. This can be useful when consuming ESM only packages in a CJS build.

For example, the `unified` ecosystem is all ESM-only. Let's also say we're using a `@sindresorhus/slugify` which is ESM-only as well. Here's how you would be able to consume those packages in a CJS app without having to use dynamic imports:

```ts filename=remix.config.js lines=[8-13]
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  publicPath: "/build/",
  serverBuildDirectory: "build",
  ignoredRouteFiles: ["**/.*"],
  serverDependenciesToBundle: [
    /^rehype.*/,
    /^remark.*/,
    /^unified.*/,
    "@sindresorhus/slugify",
  ],
};
```

### watchPaths

A function for defining custom directories to watch while running [remix dev][remix-dev], in addition to [`appDirectory`][app-directory].

```tsx
exports.watchPaths = async () => {
  return ["/some/path/*"];
};
```

## File Name Conventions

There are a few conventions that Remix uses you should be aware of.

<docs-info>[Dilum Sanjaya][dilum-sanjaya] made [an awesome visualization][an-awesome-visualization] of how routes in the file system map to the URL in your app that might help you understand these conventions.</docs-info>

### Special Files

- **`remix.config.js`**: Remix uses this file to know how to build your app for production and run it in development. This file is required.
- **`app/entry.server.{js,jsx,ts,tsx}`**: This is your entry into the server rendering piece of Remix. This file is required.
- **`app/entry.client.{js,jsx,ts,tsx}`**: This is your entry into the browser rendering/hydration piece of Remix. This file is required.

### Route File Conventions

Setting up routes in Remix is as simple as creating files in your `app` directory. These are the conventions you should know to understand how routing in Remix works.

Please note that you can use either `.js`, `.jsx` or `.tsx` file extensions depending on whether or not you use TypeScript. We'll stick with `.tsx` in the examples to avoid duplication (and because we ❤️ TypeScript).

#### Root Layout Route

<!-- prettier-ignore -->
```markdown [3]
app/
├── routes/
└── root.tsx
```

The file in `app/root.tsx` is your root layout, or "root route" (very sorry for those of you who pronounce those words the same way!). It works just like all other routes:

- You can export a [`loader`][loader], [`action`][action], [`meta`][meta], [`headers`][headers-2], or [`links`][links] function
- You can export an [`ErrorBoundary`][error-boundary] or [`CatchBoundary`][catch-boundary]
- Your default export is the layout component that renders the rest of your app in an [`<Outlet />`][outlet]

#### Basic Routes

<!-- prettier-ignore -->
```markdown [3-4]
app/
├── routes/
│   ├── about.tsx
│   └── index.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL      | Matched Route          |
| -------- | ---------------------- |
| `/`      | `app/routes/index.tsx` |
| `/about` | `app/routes/about.tsx` |

</details>

Any JavaScript or TypeScript files in the `app/routes/` directory will become routes in your application. The filename maps to the route's URL pathname, except for `index.tsx` which maps to the root pathname.

The default export in this file is the component that is rendered at that route and will render within the `<Outlet />` rendered by the root route.

#### Dynamic Route Parameters

<!-- prettier-ignore -->
```markdown [4]
app/
├── routes/
│   ├── blog/
│   │   ├── $postId.tsx
│   │   ├── categories.tsx
│   │   ├── index.tsx
│   └── about.tsx
│   └── index.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL                | Matched Route                    |
| ------------------ | -------------------------------- |
| `/blog`            | `app/routes/blog/index.tsx`      |
| `/blog/categories` | `app/routes/blog/categories.tsx` |
| `/blog/my-post`    | `app/routes/blog/$postId.tsx`    |

</details>

Routes that begin with a `$` character indicate the name of a dynamic segment of the URL. It will be parsed and passed to your loader and action data as a value on the `param` object.

For example: `app/routes/blog/$postId.tsx` will match the following URLs:

- `/blog/my-story`
- `/blog/once-upon-a-time`
- `/blog/how-to-ride-a-bike`

On each of these pages, the dynamic segment of the URL path is the value of the parameter. There can be multiple parameters active at any time (as in `/dashboard/:client/invoices/:invoiceId` [view example app][view-example-app]) and all parameters can be accessed within components via [`useParams`][use-params] and within loaders/actions via the argument's [`params`][params] property:

```tsx filename=app/routes/blog/$postId.tsx
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node"; // or cloudflare/deno
import { useParams } from "@remix-run/react";

export const loader = async ({ params }: LoaderArgs) => {
  console.log(params.postId);
};

export const action = async ({ params }: ActionArgs) => {
  console.log(params.postId);
};

export default function PostRoute() {
  const params = useParams();
  console.log(params.postId);
}
```

Nested routes can also contain dynamic segments by using the `$` character in the parent's directory name. For example, `app/routes/blog/$postId/edit.tsx` might represent the editor page for blog entries.

See the [routing guide][routing-guide] for more information.

#### Layout Routes

<!-- prettier-ignore -->
```markdown [3,8]
app/
├── routes/
│   ├── blog/
│   │   ├── $postId.tsx
│   │   ├── categories.tsx
│   │   ├── index.tsx
│   └── about.tsx
│   └── blog.tsx
│   └── index.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL                | Matched Route                    | Layout                |
| ------------------ | -------------------------------- | --------------------- |
| `/`                | `app/routes/index.tsx`           | `app/root.tsx`        |
| `/about`           | `app/routes/about.tsx`           | `app/root.tsx`        |
| `/blog`            | `app/routes/blog/index.tsx`      | `app/routes/blog.tsx` |
| `/blog/categories` | `app/routes/blog/categories.tsx` | `app/routes/blog.tsx` |
| `/blog/my-post`    | `app/routes/blog/$postId.tsx`    | `app/routes/blog.tsx` |

</details>

In the example above, the `blog.tsx` is a "layout route" for everything within the `blog` directory (`blog/index.tsx` and `blog/categories.tsx`). When a route has the same name as its directory (`routes/blog.tsx` and `routes/blog/`), it becomes a layout route for all of the routes inside that directory ("child routes"). Similar to your [root route][root-route], the parent route should render an `<Outlet />` where the child routes should appear. This is how you can create multiple levels of persistent layout nesting associated with URLs.

#### Pathless Layout Routes

<!-- prettier-ignore -->
```markdown [3,7,10-11]
app/
├── routes/
│   ├── __app/
│   │   ├── dashboard.tsx
│   │   └── $userId/
│   │   │   └── profile.tsx
│   └── __marketing
│   │   ├── index.tsx
│   │   └── product.tsx
│   ├── __app.tsx
│   ├── __marketing.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL               | Matched Route                          | Layout                       |
| ----------------- | -------------------------------------- | ---------------------------- |
| `/`               | `app/routes/__marketing/index.tsx`     | `app/routes/__marketing.tsx` |
| `/product`        | `app/routes/__marketing/product.tsx`   | `app/routes/__marketing.tsx` |
| `/dashboard`      | `app/routes/__app/dashboard.tsx`       | `app/routes/__app.tsx`       |
| `/chance/profile` | `app/routes/__app/$userId/profile.tsx` | `app/routes/__app.tsx`       |

</details>

You can also create layout routes _without adding segments to the URL_ by prepending the directory and associated parent route file with double underscores: `__`.

For example, all of your marketing pages could be in `app/routes/__marketing/*` and then share a layout by creating `app/routes/__marketing.tsx`. A route `app/routes/__marketing/product.tsx` would be accessible at the `/product` URL because `__marketing` won't add segments to the URL, just UI hierarchy.

<docs-warning>Be careful, pathless layout routes introduce the possibility of URL conflicts</docs-warning>

#### Dot Delimiters

<!-- prettier-ignore -->
```markdown [8]
app/
├── routes/
│   ├── blog/
│   │   ├── $postId.tsx
│   │   ├── categories.tsx
│   │   ├── index.tsx
│   └── about.tsx
│   └── blog.authors.tsx
│   └── blog.tsx
│   └── index.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL                | Matched Route                    | Layout                |
| ------------------ | -------------------------------- | --------------------- |
| `/blog`            | `app/routes/blog/index.tsx`      | `app/routes/blog.tsx` |
| `/blog/categories` | `app/routes/blog/categories.tsx` | `app/routes/blog.tsx` |
| `/blog/authors`    | `app/routes/blog.authors.tsx`    | `app/root.tsx`        |

</details>

By creating a file with `.` characters between segments, you can create a nested URL without nested layouts. For example, a file `app/routes/blog.authors.tsx` will route to the pathname `/blog/authors`, but it will not share a layout with routes in the `app/routes/blog/` directory.

#### Splat Routes

<!-- prettier-ignore -->
```markdown [7]
app/
├── routes/
│   ├── blog/
│   │   ├── $postId.tsx
│   │   ├── categories.tsx
│   │   ├── index.tsx
│   └── $.tsx
│   └── about.tsx
│   └── blog.authors.tsx
│   └── blog.tsx
│   └── index.tsx
└── root.tsx
```

<details>

<summary>URL Route Matches</summary>

| URL               | Matched Route               | Layout                |
| ----------------- | --------------------------- | --------------------- |
| `/`               | `app/routes/index.tsx`      | `app/root.tsx`        |
| `/blog`           | `app/routes/blog/index.tsx` | `app/routes/blog.tsx` |
| `/somewhere-else` | `app/routes/$.tsx`          | `app/root.tsx`        |

</details>

Files that are named `$.tsx` are called "splat" (or "catch-all") routes. These routes will map to any URL not matched by other route files in the same directory.

Similar to dynamic route parameters, you can access the value of the matched path on the splat route's `params` with the `"*"` key.

```tsx filename=app/routes/$.tsx
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node"; // or cloudflare/deno
import { useParams } from "@remix-run/react";

export const loader = async ({ params }: LoaderArgs) => {
  console.log(params["*"]);
};

export const action = async ({ params }: ActionArgs) => {
  console.log(params["*"]);
};

export default function PostRoute() {
  const params = useParams();
  console.log(params["*"]);
}
```

### Escaping special characters

Because some characters have special meaning, you must use our escaping syntax if you want those characters to actually appear in the route. For example, if I wanted to make a [Resource Route][resource-route] for a `/sitemap.xml`, I could name the file `app/routes/[sitemap.xml].tsx`. So you simply wrap any part of the filename with brackets and that will escape any special characters.

<docs-info>
  Note, you could even do `app/routes/sitemap[.]xml.tsx` if you wanted to only wrap the part that needs to be escaped. It makes no difference. Choose the one you like best.
</docs-info>

## Entry Files

### entry.client.tsx

Remix uses `app/entry.client.tsx` as the entry point for the browser bundle. This module gives you full control over the "hydrate" step after JavaScript loads into the document.

Typically this module uses `ReactDOM.hydrate` to re-hydrate the markup that was already generated on the server in your [server entry module][server-entry-module].

Here's a basic example:

```tsx
import { hydrate } from "react-dom";
import { RemixBrowser } from "@remix-run/react";

hydrate(<RemixBrowser />, document);
```

This is the first piece of code that runs in the browser. As you can see, you have full control here. You can initialize client side libraries, setup things like `window.history.scrollRestoration`, etc.

### entry.server.tsx

Remix uses `app/entry.server.tsx` to generate the HTTP response when rendering on the server. The `default` export of this module is a function that lets you create the response, including HTTP status, headers, and HTML, giving you full control over the way the markup is generated and sent to the client.

This module should render the markup for the current page using a `<RemixServer>` element with the `context` and `url` for the current request. This markup will (optionally) be re-hydrated once JavaScript loads in the browser using the [browser entry module][browser-entry-module].

You can also export an optional `handleDataRequest` function that will allow you to modify the response of a data request. These are the requests that do not render HTML, but rather return the loader and action data to the browser once client side hydration has occurred.

Here's a basic example:

```tsx
import { renderToString } from "react-dom/server";
import type {
  EntryContext,
  HandleDataRequestFunction,
} from "@remix-run/node"; // or cloudflare/deno
import { RemixServer } from "@remix-run/react";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
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

It's important to read [Route Module Constraints][route-module-constraints].

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

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Single</a>: <a href="https://www.youtube.com/watch?v=NXqEP_PsPNc&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Loading data into components</a></docs-success>

Each route can define a "loader" function that will be called on the server before rendering to provide data to the route. You may think of this as a "GET" request handler in that you should not be reading the body of the request; that is the job of an [`action`][action].

```tsx
import { json } from "@remix-run/node"; // or cloudflare/deno

export const loader = async () => {
  // The `json` function converts a serializable object into a JSON response
  // All loaders must return a `Response` object.
  return json({ ok: true });
};
```

This function is only ever run on the server. On the initial server render it will provide data to the HTML document. On navigations in the browser, Remix will call the function via [`fetch`][fetch]. This means you can talk directly to your database, use server only API secrets, etc. Any code that isn't used to render the UI will be removed from the browser bundle.

Using the database ORM Prisma as an example:

```tsx lines=[1-2,6-8,11]
import { json } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";

import { prisma } from "../db";

export const loader = async () => {
  return json(await prisma.user.findMany());
};

export default function Users() {
  const data = useLoaderData<typeof loader>();
  return (
    <ul>
      {data.map((user) => (
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

```tsx
// if the user visits /invoices/123
export const loader = async ({ params }: LoaderArgs) => {
  params.invoiceId; // "123"
};
```

#### loader `request`

This is a [Fetch Request][request] instance with information about the request. You can read the MDN docs to see all of its properties.

Most common cases are reading headers or the URL. You can also use this to read URL [URLSearchParams][urlsearchparams] from the request like so:

```tsx
export const loader = async ({ request }: LoaderArgs) => {
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
  createRequestHandler,
} = require("@remix-run/express");

app.all(
  "*",
  createRequestHandler({
    getLoadContext(req, res) {
      // this becomes the loader context
      return { expressUser: req.user };
    },
  })
);
```

And then your loader can access it.

```tsx
export const loader = async ({ context }: LoaderArgs) => {
  const { expressUser } = context;
  // ...
};
```

#### Returning Response Instances

You need to return a [Fetch Response][response] from your loader.

```tsx
export const loader = async () => {
  const users = await db.users.findMany();
  const body = JSON.stringify(users);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
```

Using the `json` helper simplifies this so you don't have to construct them yourself, but these two examples are effectively the same!

```tsx
import { json } from "@remix-run/node"; // or cloudflare/deno

export const loader = async () => {
  const users = await fakeDb.users.findMany();
  return json(users);
};
```

You can see how `json` just does a little of the work to make your loader a lot cleaner. You can also use the `json` helper to add headers or a status code to your response:

```tsx
import type { LoaderArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno

export const loader = async ({ params }: LoaderArgs) => {
  const user = await fakeDb.project.findOne({
    where: { id: params.id },
  });

  if (!user) {
    return json("Project not found", { status: 404 });
  }

  return json(user);
};
```

See also:

- [`headers`][headers-2]
- [MDN Response Docs][response]

#### Throwing Responses in Loaders

Along with returning responses, you can also throw Response objects from your loaders, allowing you to break through the call stack and show an alternate UI with contextual data through the `CatchBoundary`.

Here is a full example showing how you can create utility functions that throw responses to stop code execution in the loader and move over to an alternative UI.

```ts filename=app/db.ts
import { json } from "@remix-run/node"; // or cloudflare/deno
import type { ThrownResponse } from "@remix-run/react";

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
import { redirect } from "@remix-run/node"; // or cloudflare/deno

import { getSession } from "./session";

export async function requireUserSession(request) {
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
import type { LoaderArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import type { ThrownResponse } from "@remix-run/react";
import { useCatch, useLoaderData } from "@remix-run/react";

import { requireUserSession } from "~/http";
import { getInvoice } from "~/db";
import type { InvoiceNotFoundResponse } from "~/db";

type InvoiceCatchData = {
  invoiceOwnerEmail: string;
};

type ThrownResponses =
  | InvoiceNotFoundResponse
  | ThrownResponse<401, InvoiceCatchData>;

export const loader = async ({
  params,
  request,
}: LoaderArgs) => {
  const user = await requireUserSession(request);
  const invoice = getInvoice(params.invoiceId);

  if (!invoice.userIds.includes(user.id)) {
    throw json(
      { invoiceOwnerEmail: invoice.owner.email },
      { status: 401 }
    );
  }

  return json(invoice);
};

export default function InvoiceRoute() {
  const invoice = useLoaderData<typeof loader>();
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
            Contact {caught.data.invoiceOwnerEmail} to get
            access
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
      Something went wrong: {caught.status}{" "}
      {caught.statusText}
    </div>
  );
}
```

### `action`

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Singles</a>: <a href="https://www.youtube.com/watch?v=Iv25HAHaFDs&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Data Mutations with Form + action</a> and <a href="https://www.youtube.com/watch?v=w2i-9cYxSdc&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Multiple Forms and Single Button Mutations</a></docs-success>

Like `loader`, action is a server only function to handle data mutations and other actions. If a non-GET request is made to your route (POST, PUT, PATCH, DELETE) then the action is called before the loaders.

Actions have the same API as loaders, the only difference is when they are called.

This enables you to co-locate everything about a data set in a single route module: the data read, the component that renders the data, and the data writes:

```tsx
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json, redirect } from "@remix-run/node"; // or cloudflare/deno
import { Form } from "@remix-run/react";

import { fakeGetTodos, fakeCreateTodo } from "~/utils/db";
import { TodoList } from "~/components/TodoList";

export async function loader() {
  return json(await fakeGetTodos());
}

export async function action({ request }: ActionArgs) {
  const body = await request.formData();
  const todo = await fakeCreateTodo({
    title: body.get("title"),
  });
  return redirect(`/todos/${todo.id}`);
}

export default function Todos() {
  const data = useLoaderData<typeof loader>();
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
- [`?index` query param][index query param]

### `headers`

Each route can define its own HTTP headers. One of the common headers is the `Cache-Control` header that indicates to browser and CDN caches where and for how long a page is able to be cached.

```tsx
export function headers({
  actionHeaders,
  loaderHeaders,
  parentHeaders,
}) {
  return {
    "X-Stretchy-Pants": "its for fun",
    "Cache-Control": "max-age=300, s-maxage=3600",
  };
}
```

Usually your data is a better indicator of your cache duration than your route module (data tends to be more dynamic than markup), so the `action`'s & `loader`'s headers are passed in to `headers()` too:

```tsx
export function headers({ loaderHeaders }) {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control"),
  };
}
```

Note: `actionHeaders` & `loaderHeaders` are an instance of the [Web Fetch API][headers] `Headers` class.

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
    "Cache-Control": `max-age=${maxAge}`,
  };
}
```

All that said, you can avoid this entire problem by _not defining headers in parent routes_ and only in leaf routes. Every layout that can be visited directly will likely have an "index route". If you only define headers on your leaf routes, not your parent routes, you will never have to worry about merging headers.

Note that you can also add headers in your `entry.server` file for things that should be global, for example:

```tsx lines=[16]
import { renderToString } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import type { EntryContext } from "@remix-run/node"; // or cloudflare/deno

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  responseHeaders.set("Content-Type", "text/html");
  responseHeaders.set("X-Powered-By", "Hugs");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
```

Just keep in mind that doing this will apply to _all_ document requests, but does not apply to `data` requests (for client-side transitions for example). For those, use [`handleDataRequest`][handledatarequest].

### `meta`

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

#### `HtmlMetaDescriptor`

This is an object representation and abstraction of a `<meta {...props}>` element and its attributes. [View the MDN docs for the meta API][view-the-mdn-docs-for-the-meta-api].

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

#### Page context in `meta` function

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
const loader = () => {
  return json({ salesCount: 1074 });
};
```

```tsx
import type { loader as salesLoader } from "../../sales";

const loader = () => {
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

### `links`

The links function defines which `<link>` elements to add to the page when the user visits a route.

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

This is an object representation of a normal `<link {...props} />` element. [View the MDN docs for the link API][link tag].

The `links` export from a route should return an array of `HtmlLinkDescriptor` objects.

Examples:

```tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import stylesHref from "~/styles/something.css";

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
      crossOrigin: "true",
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
export function links() {
  return [{ page: "/posts/public" }];
}
```

This loads up the JavaScript modules, loader data, and the stylesheets (defined in the `links` exports of the next routes) into the browser cache before the user even navigates there.

<docs-warning>Be careful with this feature. You don't want to download 10MB of JavaScript and data for pages the user probably won't ever visit.</docs-warning>

### CatchBoundary

A `CatchBoundary` is a React component that renders whenever an action or loader throws a `Response`.

**Note:** We use the word "catch" to represent the codepath taken when a `Response` type is thrown; you thought about bailing from the "happy path". This is different from an uncaught error you did not expect to occur.

A Remix `CatchBoundary` component works just like a route component, but instead of `useLoaderData` you have access to `useCatch`. When a response is thrown in an action or loader, the `CatchBoundary` will be rendered in its place, nested inside parent routes.

A `CatchBoundary` component has access to the status code and thrown response data through `useCatch`.

```tsx
import { useCatch } from "@remix-run/react";

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

A Remix `ErrorBoundary` component works just like normal React [error boundaries][error-boundaries], but with a few extra capabilities. When there is an error in your route component, the `ErrorBoundary` will be rendered in its place, nested inside any parent routes. `ErrorBoundary` components also render when there is an error in the `loader` or `action` functions for a route, so all errors for that route may be handled in one spot.

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

```tsx
export const handle = {
  its: "all yours",
};
```

This is almost always used on conjunction with `useMatches`. To see what kinds of things you can do with it, refer to [`useMatches`][use-matches] for more information.

### unstable_shouldReload

<docs-warning>This API is unstable, we're confident in the use cases it solves but aren't sure about the API yet, it may change in the future.</docs-warning>

<docs-warning>This feature is an <i>additional</i> optimization. In general, Remix's design does a great job of only calling the loaders that the next page needs and ensuring your UI is in sync with your server. When you use this feature you risk your UI getting out of sync with your server. Use with caution!</docs-warning>

This function lets apps optimize which routes should be reloaded on some client-side transitions.

```tsx
import type { ShouldReloadFunction } from "@remix-run/react";

export const unstable_shouldReload: ShouldReloadFunction =
  ({
    // same params that go to `loader` and `action`
    params,

    // a possible form submission that caused this to be reloaded
    submission,

    // the next URL being used to render this page
    url,

    // the previous URL used to render this page
    prevUrl,
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

```tsx lines=[10]
export const loader = async () => {
  return json({
    ENV: {
      CLOUDINARY_ACCT: process.env.CLOUDINARY_ACCT,
      STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
    },
  });
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
+------------------------------+
|    Project: Design Revamp    |
+------------------------------+
|  Tasks | Collabs | >ACTIVITY |
+------------------------------+
|  Search: _____________       |
|                              |
|  - Ryan added an image       |
|                              |
|  - Michael commented         |
|                              |
+------------------------------+
```

The `activity.tsx` loader can use the search params to filter the list, so visiting a URL like `/projects/design-revamp/activity?search=image` could filter the list of results. Maybe it looks something like this:

```tsx lines=[5,11]
export async function loader({
  params,
  request,
}: LoaderArgs) {
  const url = new URL(request.url);
  return json(
    await exampleDb.activity.findAll({
      where: {
        projectId: params.projectId,
        name: {
          contains: url.searchParams.get("search"),
        },
      },
    })
  );
}
```

This is great for the activity route, but Remix doesn't know if the parent loader, `$projectId.tsx` _also_ cares about the search params. That's why Remix does the safest thing and reloads all the routes on the page when the search params change.

In this UI, that's wasted bandwidth for the user, your server, and your database because `$projectId.tsx` doesn't use the search params. Consider that our loader for `$projectId.tsx` looks something like this:

```tsx
export async function loader({ params }: LoaderArgs) {
  return json(await fakedb.findProject(params.projectId));
}
```

We want this loader to be called only if the project has had an update, so we can make this really simple and just say to reload if there is a non-GET submission:

```tsx
export function unstable_shouldReload({ submission }) {
  return !!submission && submission.method !== "GET";
}
```

Now if the child route causes the search params to change, this route will no longer be reloaded because there was no submission.

<docs-info>When you want to optimize a loader, instead of thinking about the thing causing the reload (search params), think only about the loader's requirements that you're optimizing.</docs-info>

You may want to get more granular and reload only for submissions to this project:

```tsx
export function unstable_shouldReload({
  params,
  submission,
}) {
  return !!(
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

```tsx filename=app/routes/root.tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

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
[form]: ./remix#form
[form action]: ./remix#form-action
[index query param]: ../guides/routing#what-is-the-index-query-param
[link tag]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link
[minimatch]: https://www.npmjs.com/package/minimatch
[handledatarequest]: #entryservertsx
[server-build-path]: #serverbuildpath
[server-build-target]: #serverbuildtarget
[arc]: https://arc.codes
[cloudflare-pages]: https://pages.cloudflare.com
[cloudflare-workers]: https://workers.cloudflare.com
[deno]: https://deno.land
[netlify]: https://www.netlify.com
[node-cjs]: https://nodejs.org/en
[vercel]: https://vercel.com
[dilum-sanjaya]: https://twitter.com/DilumSanjaya
[an-awesome-visualization]: https://remix-routing-demo.netlify.app
[loader]: #loader
[action]: #action
[meta]: #meta
[headers-2]: #headers
[links]: #links
[error-boundary]: #errorboundary
[catch-boundary]: #catchboundary
[outlet]: https://reactrouter.com/docs/components/outlet
[view-example-app]: https://github.com/remix-run/examples/tree/main/multiple-params
[use-params]: https://reactrouter.com/docs/hooks/use-params
[params]: #loader-params
[routing-guide]: ../guides/routing
[root-route]: #root-layout-route
[resource-route]: ../guides/resource-routes
[server-entry-module]: #entryservertsx
[browser-entry-module]: #entryclienttsx
[route-module-constraints]: ../guides/constraints
[view-the-mdn-docs-for-the-meta-api]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta
[open-graph-tags]: https://ogp.me
[html-title-element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title
[http-equiv-tag]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-http-equiv
[error-boundaries]: https://reactjs.org/docs/error-boundaries.html
[use-matches]: ./remix#usematches
[remix-dev]: https://remix.run/docs/en/v1/other-api/dev#remix-dev
[app-directory]: #appDirectory
