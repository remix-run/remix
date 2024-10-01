---
"@remix-run/dev": patch
---

Stop passing `request.signal` as the `renderToReadableStream` `signal` to abort server rendering for cloudflare/deno runtimes because by the time that `request` is aborted, aborting the rendering is useless because there's no way for React to flush down the unresolved boundaries

- This has been incorrect for some time, but only recently exposed due to a bug in how we were aborting requests when running via `remix vite:dev` because we were incorrectly aborting requests after successful renders - which was causing us to abort a completed React render, and try to close an already closed `ReadableStream`.
- This has likely not shown up in any production scenarios because cloudflare/deno production runtimes are (correctly) not aborting the `request.signal` on successful renders
- The built-in `entry.server` files no longer pass a `signal` to `renderToReadableStream` because adding a timeout-based abort signal to the default behavior would constitute a breaking change
- Users can configure this abort behavior via their own `entry.server` via `remix reveal entry.server`, and the template entry.server files have been updated with an example approach for newly created Remix apps
