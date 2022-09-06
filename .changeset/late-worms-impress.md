---
"remix": patch
"@remix-run/node": patch
---

convert fetch `WebResponse` to `NodeResponse` so the response returned is that of `global.Response` otherwise a `response instanceof Response` check would fail.
