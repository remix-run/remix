---
title: Server vs. Client Code Execution
order: 5
---

# Server vs. Client Code Execution

Remix runs your app on the server as well as in the browser. However, it doesn't run all of your code in both places.

During the build step, the compiler creates both a server build and a client build. The server build bundles up everything into a single module, but the client build splits your app up into multiple bundles to optimize loading in the browser. It also removes server code from the bundles.

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

## Forcing Code Out of the Browser or Server Builds

You can force code out of either the client or the server with the [`*.client.ts`][file_convention_client] and [`*.server.ts`][file_convention_server] conventions.

While rare, sometimes server code makes it to client bundles because of how the compiler determines the dependencies of a route module, or because you accidentally try to use it in code that needs to ship to the client. You can force it out by adding `*.server.ts` on the end of the file name.

For example, we could name a module `app/user.server.ts` instead of `app/user.ts` to ensure that the code in that module is never bundled into the client — even if you try to use it in the component.

Additionally, you may depend on client libraries that are unsafe to even bundle on the server — maybe it tries to access [`window`][window_global] by simply being imported. You can likewise remove these modules from the server build by appending `*.client.ts` to the file name.

[action]: ../route/action
[headers]: ../route/headers
[loader]: ../route/loader
[file_convention_client]: ../file-conventions/-client
[file_convention_server]: ../file-conventions/-server
[window_global]: https://developer.mozilla.org/en-US/docs/Web/API/Window/window
