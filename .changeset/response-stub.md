---
"@remix-run/server-runtime": patch
---

Add `ResponseStub` header interface for single fetch and deprecate the `headers` export

- The `headers` export is no longer used when single fetch is enabled
- `loader`/`action` functions now receive a mutable `response` parameter
  - `type ResponseStub = { status: numbers | undefined, headers: Headers }`
- To alter the status of a response, set the `status` field directly
  - `response.status = 201`
- To set headers on the Response, you may use:
  - `response.headers.set`
  - `response.headers.append`
  - `response.headers.delete`
- Each `loader`/`action`receives it's own unique `response` instance so you cannot see what other `loader`/`action` functions have set (which would be subject to race conditions)
- If all status codes are unset or have values <200, the deepest status code will be used for the HTTP response
- If any status codes are set to a value >=300, the highest >=300 value will be used for the HTTP Response
- Remix tracks header operations and will replay them in order (action if present, then loaders top-down) after all handlers have completed on a fresh `Headers` instance that will be applied to the HTTP Response
  - `headers.set` on any child handler will overwrite values from parent handlers
  - `headers.append` can be used to set the same header from both a parent and child handler
  - `headers.delete` can be used to delete a value set by a parent handler, but not a value set from a child handler
- Because single fetch supports naked object returns, and you no longer need to return a `Response` instance to set status/headers, the `json`/`redirect`/`redirectDocument`/`defer` utilities are considered deprecated when using Single Fetch
- You may still continue returning normal `Response` instances and they'll apply status codes in the same way, and will apply all headers via `headers.set` - overwriting any same-named header values from parents
  - If you need to append, you will need to switch from returning a `Response` instance to using the new `response` parameter
