---
"@remix-run/server-runtime": patch
---

Single Fetch: Remove `responseStub` in favor of `headers`

* Background
  * The original Single Fetch approach was based on an assumption that an eventual `middleware` implementation would require something like `ResponseStub` so users could mutate `status`/`headers` in `middleware` before/after handlers as well as during handlers
  * We wanted to align how `headers` got merged between document and data requests
  * So we made document requests also use `ResponseStub` and removed the usage of `headers` in Single Fetch
  * The realization/alignment between Michael and Ryan on the recent [roadmap planning](https://www.youtube.com/watch?v=f5z_axCofW0) made us realize that the original assumption was incorrect
  * `middleware` won't need a stub - users can just mutate the `Response` they get from `await next()` directly
  * With that gone, and still wanting to align how `headers` get merged, it makes more sense to stick with the current `headers` API and apply that to Single Fetch and avoid introducing a totally new thing in `RepsonseStub` (that always felt a bit awkward to work with anyway)

* With this change:
  * You are encouraged to stop returning `Response` instances in favor of returning raw data from loaders and actions:
    * ~~`return json({ data: whatever });`~~
    * `return { data: whatever };`
  * In most cases, you can remove your `json()` and `defer()` calls in favor of returning raw data if they weren't setting custom `status`/`headers`
    * We will be removing both `json` and `defer` in the next major version, but both _should_ still work in Single Fetch in v2 to allow for incremental adoption of the new behavior
  * If you need custom `status`/`headers`:
    * We've added a new `unstable_data({...}, responseInit)` utility that will let you send back `status`/`headers` alongside your raw data without having to encode it into a `Response`
  * The `headers()` function will let you control header merging for both document and data requests
