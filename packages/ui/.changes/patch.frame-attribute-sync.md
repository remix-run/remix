---
'@remix-run/ui':
  patch: |
    Preserve client-set attributes across top-frame navigations.
    `syncElementAttributes` previously removed any attribute on the live `<html>`/`<body>` that was not present in the server HTML, discarding client-owned state such as a `class="dark"` toggle or `data-modal-open` flag.

    Three changes:

    1. **Client attributes now survive a server reload.** Attributes that the server stops sending on a navigation no longer get removed on the client. Concretely: the server can no longer clear a root attribute by simply omitting it from the next response. App authors who want a server-driven clearing now need to explicitly send an empty value (e.g. `class=""`).

    2. **`class` is special-cased to token-merge rather than overwrite.** If the client added `class="dark"` and the server sent `class="h-full"`, the post-reload `<html>` has `class="h-full dark"` — both tokens survive. Other attributes still use the standard "server wins on value" semantics. This covers the real-world `dark`/light theme toggle plus class-driven layout without forcing the server to know the full client state.

    3. **`<body>` is now synced too.** Previously only `<html>` received the sync; `<body>` attributes are now mirrored with the same semantics.
  ---
