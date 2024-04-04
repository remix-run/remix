---
"@remix-run/node": patch
"@remix-run/serve": patch
---

- Put `undici` fetch polyfill behind a new `installGlobals({ nativeFetch: true })` parameter
- `remix-serve` will default to using `undici` for the fetch polyfill if `future._unstable_singleFetch` is enabled because the single fetch implementation relies on the `undici` polyfill
  - Any users opting into Single Fetch and managing their own polfill will need to pass the flag to `installGlobals` on their own to avoid runtime errors with Single Fetch

