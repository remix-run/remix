---
title: Server vs. Client Code Execution
order: 5
---

# Server vs. Client Code Execution

Remix runs your app on the server as well as in the browser. However, it doesn't run all of your code in both places.

During the build step, the compiler creates both a server build and a client build. The server build bundles up everything into a single module (or multiple modules when using [server bundles][server-bundles]), but the client build splits your app up into multiple bundles to optimize loading in the browser. It also removes server code from the bundles.

The following route exports and the dependencies used within them are removed from the client build:

- [`action`][action]
- [`headers`][headers]
- [`loader`][loader]

Consider this route module from the last section:

```tsx filename=routes/settings.tsx
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";

import { getUser, updateUser } from "../user";

export const headers: HeadersFunction = () => ({
  "Cache-Control": "max-age=300, s-maxage=3600",
});

export async function loader({
  request,
}: LoaderFunctionArgs) {
  const user = await getUser(request);
  return json({
    displayName: user.displayName,
    email: user.email,
  });
}

export default function Component() {
  const user = useLoaderData<typeof loader>();
  return (
    <Form action="/account">
      <h1>Settings for {user.displayName}</h1>

      <input
        name="displayName"
        defaultValue={user.displayName}
      />
      <input name="email" defaultValue={user.email} />

      <button type="submit">Save</button>
    </Form>
  );
}

export async function action({
  request,
}: ActionFunctionArgs) {
  const formData = await request.formData();
  const user = await getUser(request);

  await updateUser(user.id, {
    email: formData.get("email"),
    displayName: formData.get("displayName"),
  });

  return json({ ok: true });
}
```

The server build will contain the entire module in the final bundle. However, the client build will remove the `action`, `headers` and `loader`, along with the dependencies, resulting in this:

```tsx filename=routes/settings.tsx
import { useLoaderData } from "@remix-run/react";

export default function Component() {
  const user = useLoaderData();
  return (
    <Form action="/account">
      <h1>Settings for {user.displayName}</h1>

      <input
        name="displayName"
        defaultValue={user.displayName}
      />
      <input name="email" defaultValue={user.email} />

      <button type="submit">Save</button>
    </Form>
  );
}
```

## Splitting Up Client and Server Code

Out of the box, Vite doesn't support mixing server-only code with client-safe code in the same module.
Remix is able to make an exception for routes because we know which exports are server-only and can remove them from the client.

There are a few ways to isolate server-only code in Remix.
The simplest approach is to use [`.server`][file_convention_server] and [`.client`][file_convention_client] modules.

#### `.server` modules

While not strictly necessary, [`.server` modules][file_convention_server] are a good way to explicitly mark entire modules as server-only.
The build will fail if any code in a `.server` file or `.server` directory accidentally ends up in the client module graph.

```txt
app
├── .server 👈 marks all files in this directory as server-only
│   ├── auth.ts
│   └── db.ts
├── cms.server.ts 👈 marks this file as server-only
├── root.tsx
└── routes
    └── _index.tsx
```

`.server` modules must be within your Remix app directory.

<docs-warning>`.server` directories are only supported when using [Remix Vite][remix-vite]. The [Classic Remix Compiler][classic-remix-compiler] only supports `.server` files.</docs-warning>

#### `.client` modules

You may depend on client libraries that are unsafe to even bundle on the server — maybe it tries to access [`window`][window_global] by simply being imported.

You can remove the contents of these modules from the server build by appending `*.client.ts` to the file name or nesting them within a `.client` directory.

<docs-warning>`.client` directories are only supported when using [Remix Vite][remix-vite]. The [Classic Remix Compiler][classic-remix-compiler] only supports `.client` files.</docs-warning>

#### vite-env-only

If you want to mix server-only code and client-safe code in the same module, you
can use <nobr>[vite-env-only][vite-env-only]</nobr>.
This Vite plugin allows you to explicitly mark any expression as server-only so that it gets
replaced with `undefined` in the client.

For example, once you've added the plugin to your [Vite config][vite-config], you can wrap any server-only exports with `serverOnly$`:

```tsx
import { serverOnly$ } from "vite-env-only";

import { db } from "~/.server/db";

export const getPosts = serverOnly$(async () => {
  return db.posts.findMany();
});

export const PostPreview = ({ title, description }) => {
  return (
    <article>
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  );
};
```

This example would be compiled into the following code for the client:

```tsx
export const getPosts = undefined;

export const PostPreview = ({ title, description }) => {
  return (
    <article>
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  );
};
```

[action]: ../route/action
[headers]: ../route/headers
[loader]: ../route/loader
[file_convention_client]: ../file-conventions/-client
[file_convention_server]: ../file-conventions/-server
[window_global]: https://developer.mozilla.org/en-US/docs/Web/API/Window/window
[server-bundles]: ../future/server-bundles
[vite-config]: ../file-conventions/vite-configuration
[vite-env-only]: https://github.com/pcattori/vite-env-only
[classic-remix-compiler]: ../future/vite#classic-remix-compiler-vs-remix-vite
[remix-vite]: ../future/vite
