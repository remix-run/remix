---
title: loader
---

# `loader`

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Single</a>: <a href="https://www.youtube.com/watch?v=NXqEP_PsPNc&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Loading data into components</a></docs-success>

Each route can define a `loader` function that provides data to the route when rendering.

```tsx
import { json } from "@remix-run/node"; // or cloudflare/deno

export const loader = async () => {
  return json({ ok: true });
};
```

This function is only ever run on the server. On the initial server render, it will provide data to the HTML document. On navigations in the browser, Remix will call the function via [`fetch`][fetch] from the browser.

This means you can talk directly to your database, use server-only API secrets, etc. Any code not used to render the UI will be removed from the browser bundle.

Using the database ORM [Prisma][prisma] as an example:

```tsx lines=[3,5-7]
import { useLoaderData } from "@remix-run/react";

import { prisma } from "../db";

export async function loader() {
  return json(await prisma.user.findMany());
}

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

Because `prisma` is only used in the `loader` it will be removed from the browser bundle by the compiler, as illustrated by the highlighted lines.

<docs-error>
Note that whatever you return from your `loader` will be exposed to the client, even if the component doesn't render it. Treat your `loader`s with the same care as public API endpoints.
</docs-error>

## Type Safety

You can get type safety over the network for your `loader` and component with `useLoaderData<typeof loader>`.

```tsx lines=[9]
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader() {
  return json({ name: "Ryan", date: new Date() });
}

export default function SomeRoute() {
  const data = useLoaderData<typeof loader>();
}
```

- `data.name` will know that it's a string
- `data.date` will also know that it's a string even though we passed a date object to [`json`][json]. When data is fetched for client transitions, the values are serialized over the network with [`JSON.stringify`][json-stringify], and the types are aware of that

## `params`

Route params are defined by route file names. If a segment begins with `$` like `$invoiceId`, the value from the URL for that segment will be passed to your `loader`.

```tsx filename=app/routes/invoices.$invoiceId.tsx nocopy
// if the user visits /invoices/123
export async function loader({
  params,
}: LoaderFunctionArgs) {
  params.invoiceId; // "123"
}
```

Params are mostly useful for looking up records by ID:

```tsx filename=app/routes/invoices.$invoiceId.tsx
// if the user visits /invoices/123
export async function loader({
  params,
}: LoaderFunctionArgs) {
  const invoice = await fakeDb.getInvoice(params.invoiceId);
  if (!invoice) throw new Response("", { status: 404 });
  return json(invoice);
}
```

## `request`

This is a [Fetch Request][request] instance. You can read the MDN docs to see all of its properties.

The most common use cases in `loader`s are reading [headers][request-headers] (like cookies) and URL [`URLSearchParams`][url-search-params] from the request:

```tsx
export async function loader({
  request,
}: LoaderFunctionArgs) {
  // read a cookie
  const cookie = request.headers.get("Cookie");

  // parse the search params for `?q=`
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
}
```

## `context`

This is the context passed in to your server adapter's `getLoadContext()` function. It's a way to bridge the gap between the adapter's request/response API with your Remix app.

<docs-info>This API is an escape hatch, it’s uncommon to need it</docs-info>

Using the express adapter as an example:

```ts filename=server.ts
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

And then your `loader` can access it.

```tsx filename=app/routes/some-route.tsx
export async function loader({
  context,
}: LoaderFunctionArgs) {
  const { expressUser } = context;
  // ...
}
```

## Returning Response Instances

You need to return a [Fetch Response][response] from your `loader`.

```tsx
export async function loader() {
  const users = await db.users.findMany();
  const body = JSON.stringify(users);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
```

Using the [`json` helper][json] simplifies this, so you don't have to construct them yourself, but these two examples are effectively the same!

```tsx
import { json } from "@remix-run/node"; // or cloudflare/deno

export const loader = async () => {
  const users = await fakeDb.users.findMany();
  return json(users);
};
```

You can see how `json` just does a little of the work to make your `loader` a lot cleaner. You can also use the `json` helper to add headers or a status code to your response:

```tsx
import { json } from "@remix-run/node"; // or cloudflare/deno

export const loader = async ({
  params,
}: LoaderFunctionArgs) => {
  const project = await fakeDb.project.findOne({
    where: { id: params.id },
  });

  if (!project) {
    return json("Project not found", { status: 404 });
  }

  return json(project);
};
```

See also:

- [`headers`][headers]
- [MDN Response Docs][response]

## Throwing Responses in Loaders

Along with returning responses, you can also throw `Response` objects from your `loader`s. This allows you to break through the call stack and do one of two things:

- Redirect to another URL
- Show an alternate UI with contextual data through the `ErrorBoundary`

Here is a full example showing how you can create utility functions that throw responses to stop code execution in the loader and show an alternative UI.

```ts filename=app/db.ts
import { json } from "@remix-run/node"; // or cloudflare/deno

export function getInvoice(id) {
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
    // You can throw our helpers like `redirect` and `json` because they
    // return `Response` objects. A `redirect` response will redirect to
    // another URL, while other  responses will trigger the UI rendered
    // in the `ErrorBoundary`.
    throw redirect("/login", 302);
  }
  return session.get("user");
}
```

```tsx filename=app/routes/invoice.$invoiceId.tsx
import type { LoaderFunctionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import {
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";

import { getInvoice } from "~/db";
import { requireUserSession } from "~/http";

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs) => {
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

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 401:
        return (
          <div>
            <p>You don't have access to this invoice.</p>
            <p>
              Contact {error.data.invoiceOwnerEmail} to get
              access
            </p>
          </div>
        );
      case 404:
        return <div>Invoice not found!</div>;
    }

    return (
      <div>
        Something went wrong: {error.status}{" "}
        {error.statusText}
      </div>
    );
  }

  return (
    <div>
      Something went wrong:{" "}
      {error?.message || "Unknown Error"}
    </div>
  );
}
```

[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[prisma]: https://www.prisma.io
[json]: ../utils/json
[json-stringify]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
[request]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[request-headers]: https://developer.mozilla.org/en-US/docs/Web/API/Response/headers
[url-search-params]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
[response]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[headers]: ../route/headers
