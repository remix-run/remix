---
title: redirectDocument
toc: false
---

# `redirectDocument`

This is a small wrapper around [`redirect`][redirect] that will trigger a document-level redirect to the new location instead of a client-side navigation.

This is most useful when you have a Remix app living remix to a non-Remix app on the same domain and need to redirect from the Remix app to the non-Remix app:

```tsx lines=[1,7]
import { redirectDocument } from "@remix-run/node"; // or cloudflare/deno

export const action = async () => {
  const userSession = await getUserSessionOrWhatever();

  if (!userSession) {
    // Assuming `/login` is a separate non-Remix app
    return redirectDocument("/login");
  }

  return json({ ok: true });
};
```

Just like [`redirect`][redirect], it accepts a status code or a `ResponseInit` as the second parameter:

```ts
redirectDocument(path, 301);
redirectDocument(path, 303);
```

```ts
redirectDocument(path, {
  headers: {
    "Set-Cookie": await commitSession(session),
  },
});
```

[redirect]: ./redirect
