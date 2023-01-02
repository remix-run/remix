---
title: loader
---

# `loader`

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Single</a>: <a href="https://www.youtube.com/watch?v=NXqEP_PsPNc&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Loading data into components</a></docs-success>

Each route can define a "loader" function that provides data to the route when rendering.

```js
export const loader = async () => {
  return { ok: true };
};
```

This function is only ever run on the server. On the initial server render it will provide data to the HTML document, On navigations in the browser, Remix will call the function via [`fetch`][fetch] from the browser.

This means you can talk directly to your database, use server only API secrets, etc. Any code that isn't used to render the UI will be removed from the browser bundle.

Using the database ORM Prisma as an example:

```tsx lines=[3,5-8]
import { useLoaderData } from "@remix-run/react";

import { prisma } from "../db";

export async function loader() {
  const users = await prisma.user.findMany();
  return users;
}

export default function Users() {
  const data = useLoaderData();
  return (
    <ul>
      {data.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

Because `prisma` is only used in the loader it will be removed from the browser bundle by the compiler, as illustrated by the highlighted lines.

## Type Safety

You can get type safety over the network for your loader and component with `DataFunctionArgs` and `useLoaderData<typeof loader>`.

```tsx lines=[5,10]
import { json } from "@remix-run/node";
import type { DataFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader(args: DataFunctionArgs) {
  return json({ name: "Ryan", date: new Date() });
}

export default function SomeRoute() {
  const data = useLoaderData<typeof loader>();
}
```

- `data.name` will know that it's a string
- `data.date` will also know that it's a string even though we passed a date object to `json`. When data is fetched for client transitions, the values are serialized over the network with `JSON.stringify`, and the types are aware of that

## `params`

Route params are defined by route file names. If a segment begins with `$` like `$invoiceId`, the value from the URL for that segment will be passed to your loader.

```ts filename=app/routes/invoices/$invoiceId.jsx
// if the user visits /invoices/123
export async function loader({ params }) {
  params.invoiceId; // "123"
}
```

Params are mostly useful for looking up records by ID:

```ts filename=app/routes/invoices/$invoiceId.jsx
// if the user visits /invoices/123
export async function loader({ params }) {
  const invoice = await fakeDb.getInvoice(params.invoiceId);
  if (!invoice) throw new Response("", { status: 404 });
  return invoice;
}
```

## `request`

This is a [Fetch Request][request] instance. You can read the MDN docs to see all of its properties.

The most common use cases in loaders are reading headers (like cookies) and URL [URLSearchParams][urlsearchparams] from the request:

```tsx
export async function loader({ request }) {
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

```js filename=server.js
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

```ts filename=routes/some-route.tsx
export async function loader({ context }) {
  const { expressUser } = context;
  // ...
}
```

## Returning Response Instances

You need to return a [Fetch Response][response] from your loader.

```ts
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

Using the `json` helper simplifies this so you don't have to construct them yourself, but these two examples are effectively the same!

```tsx
import { json } from "@remix-run/node"; // or cloudflare/deno

export const loader: LoaderFunction = async () => {
  const users = await fakeDb.users.findMany();
  return json(users);
};
```

You can see how `json` just does a little of the work to make your loader a lot cleaner. You can also use the `json` helper to add headers or a status code to your response:

```tsx
import { json } from "@remix-run/node"; // or cloudflare/deno

export const loader: LoaderFunction = async ({
  params,
}) => {
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

- [`headers`][headers]
- [MDN Response Docs][response]

## Throwing Responses in Loaders

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
import { useCatch, useLoaderData } from "@remix-run/react";
import type { ThrownResponse } from "@remix-run/react";

import { requireUserSession } from "~/http";
import { getInvoice } from "~/db";
import type {
  Invoice,
  InvoiceNotFoundResponse,
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
      invoiceOwnerEmail: invoice.owner.email,
    };
    throw json(data, { status: 401 });
  }

  return json(invoice);
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

[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[request]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[response]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[urlsearchparams]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
[headers]: ../route/headers
