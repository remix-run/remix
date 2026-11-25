The browser runtime is smaller and does less work, with no changes to app code. In our measurements, a minimal `createRoot()` app is about 40% smaller minified and gzipped, an app that also uses `on()` and `css()` is about 20% smaller, and an app that hydrates with `run()` is about 10% smaller. Apps served as unbundled ESM by `remix/assets` also make fewer module requests.

- Standalone `createRoot()` apps only load the code for the features they import. Stylesheet management and class-name generation load with `css()`, the mixin engine loads with `createMixin()`, and CSP nonce tracking and the frame runtime load only with `Frame` or `run()`.
- Standalone calls to `navigate()`, `updateUrl()`, `defaultPrefetch()`, and `spaResponse`, and components that use the `link()` mixin, no longer load the frame renderer.
- Updates to lists that mix keyed and unkeyed children skip repeated searches for child types with no match, and appending keyed children skips a pass over the old children.
- Frame updates that reorder client entries or nested frames no longer search the same sibling list for each entry, and frame responses that add import map entries no longer copy the mappings the page already installed.
- Hydration finds frames and client entries in one pass and only waits on DOM branches that contain frames.
- Focus, text selection, and scroll positions are only saved and restored when moving an element drops focus, instead of on every update.
