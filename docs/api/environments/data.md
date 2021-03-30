---
title: "@remix-run/data"
---

This package provides request/response helpers for your route `loader` and `action` exports on servers that run Node.js.

```ts
// Types
import type { LoaderFunction, ActionFunction } from "@remix-run/data";

// Helpers
import { json, redirect } from "@remix-run/data";

// Web Fetch API objects
import { Request, Response, Headers, fetch } from "@remix-run/data";
```

## `json`

This is a shortcut for creating `application/json` responses. It assumes you are using `utf-8` encoding.

```ts
import type { LoaderFunction } from "@remix-run/data";
import { json } from "@remix-run/data";

export let loader: LoaderFunction = () => {
  // So you can write this:
  return json({ any: "thing" });

  // Instead of this:
  return new Response(JSON.stringify({ any: "thing" }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
};
```

You can also pass a status code and headers:

```ts
export let loader: Loader = () => {
  return json(
    { not: "coffee" },
    {
      status: 418,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
};
```

## `redirect`

This is shortcut for sending 30x responses.

```ts [7]
import { ActionFunction } from "@remix-run/data";

export let action: ActionFunction = () => {
  let userSession = await getUserSessionOrWhatever();

  if (!userSession) {
    return redirect("/login");
  }

  return json({ ok: true });
};
```

By default it sends 302, but you can change it to which ever you'd like:

```ts
redirect(path, 301);
redirect(path, 303);
```

You can also send a `ResponseInit` to set headers, like committing a session.

```ts
redirect(path, {
  headers: {
    "Set-Cookie": await commitSession(session)
  }
});

redirect(path, {
  status: 302,
  headers: {
    "Set-Cookie": await commitSession(session)
  }
});
```

Of course, you can do redirects without this helper if you'd rather build it up yourself:

```ts
return new Response("", {
  status: 303,
  headers: {
    Location: "/else/where"
  }
});
```

## `createCookie`

TODO: Please see the [Cookie Guide](../../../guides/cookies/)

## `isCookie`

TODO: Please see the [Cookie Guide](../../../guides/cookies/)

## `createSession`

TODO: Please see the [Sessions Guide](../../../guides/sessions/)

## `isSession`

TODO: Please see the [Sessions Guide](../../../guides/sessions/)

## `createSessionStorage`

TODO: Please see the [Sessions Guide](../../../guides/sessions/)

## `createCookieSessionStorage`

TODO: Please see the [Sessions Guide](../../../guides/sessions/)

## `createFileSessionStorage`

TODO: Please see the [Sessions Guide](../../../guides/sessions/)

## `createMemorySessionStorage`

TODO: Please see the [Sessions Guide](../../../guides/sessions/)
