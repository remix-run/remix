---
title: redirect
toc: false
---

# `redirect`

This is a shortcut for sending 30x responses.

```tsx lines=[1,7]
import { redirect } from "@remix-run/node"; // or cloudflare/deno

export const action = async () => {
  const userSession = await getUserSessionOrWhatever();

  if (!userSession) {
    return redirect("/login");
  }

  return json({ ok: true });
};
```

By default, it sends 302, but you can change it to whichever redirect status code you'd like:

```ts
redirect(path, 301);
redirect(path, 303);
```

You can also send a `ResponseInit` to set headers, like committing a session.

```ts
redirect(path, {
  headers: {
    "Set-Cookie": await commitSession(session),
  },
});

redirect(path, {
  status: 302,
  headers: {
    "Set-Cookie": await commitSession(session),
  },
});
```

Of course, you can do redirects without this helper if you'd rather build it up yourself:

```ts
// this is a shortcut...
return redirect("/else/where", 303);

// ...for this
return new Response(null, {
  status: 303,
  headers: {
    Location: "/else/where",
  },
});
```

And you can throw redirects to break through the call stack and redirect right away:

```ts
if (!session) {
  throw redirect("/login", 302);
}
```
