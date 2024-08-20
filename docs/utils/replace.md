---
title: replace
toc: false
---

# `replace`

This is a small wrapper around [`redirect`][redirect] that will trigger a client-side redirect to the new location using `history.replaceState` instead of `history.pushState`.

If JavaScript has not loaded, this will behave as a standard document-level redirect and will add a new entry to the history stack.

Just like [`redirect`][redirect], it accepts a status code or a `ResponseInit` as the second parameter:

```ts
replace(path, 301);
replace(path, 303);
```

```ts
replace(path, {
  headers: {
    "Set-Cookie": await commitSession(session),
  },
});
```

[redirect]: ./redirect
