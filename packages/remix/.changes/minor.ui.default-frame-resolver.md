`run()` from `remix/ui` now fetches frame HTML by default, so apps no longer need a custom `resolveFrame` just to enable frame reloads and same-origin link and form navigation:

```diff
 let app = run({
   loadModule,
-  resolveFrame: (src, options) => fetch(src, { signal: options?.signal }),
 })
```

Keep a custom resolver when the app needs custom request headers, body encoding, response handling, or error UI. Add `rmx-document` to a link or form to leave that navigation to the browser (see #11693).
