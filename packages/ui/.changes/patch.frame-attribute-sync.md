---
'@remix-run/ui':
  patch: |
    Preserve client-set attributes on `<html>` across top-frame navigations.
    `syncElementAttributes` previously removed any attribute on the live root element that was not present in the server HTML, discarding client-owned state such as a `class="dark"` toggle or a `data-color-scheme` flag, which produced a theme flash on every top-frame navigation.

    Two changes:

    1. **Client attributes on the root now survive a server reload.** Attributes that the server stops sending on a navigation are no longer removed from `<html>`. Concretely: the server can no longer clear a root attribute by omitting it from the next response. App authors who want a server-driven clearing now need to send an explicit empty value (e.g. `class=""`).

    2. **`class` is token-merged rather than overwritten.** If the client added `class="dark"` and the server sent `class="h-full"`, the post-reload `<html>` has `class="h-full dark"` — both tokens survive, deduped. Other attributes keep the standard "server wins on value" semantics. This covers the common theme-toggle-plus-layout case without requiring the server to know the full client class state.

    `<body>` is deliberately unchanged. Its attributes are reconciled by `diffElementAttributes` in `diff-dom.ts`, which has its own preserve mechanism (`shouldPreserveLiveAttribute`); extending root-style preservation to `<body>` is a separate change.
  ---
