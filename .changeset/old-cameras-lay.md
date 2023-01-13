---
"remix": patch
"@remix-run/cloudflare": patch
"@remix-run/deno": patch
"@remix-run/node": patch
"@remix-run/react": patch
"@remix-run/serve": patch
"@remix-run/server-runtime": patch
"@remix-run/testing": patch
---

Introduces the `defer()` API from `@remix-run/router` with support for server-rendering and HTTP streaming. This utility allows you to defer values returned from loaders by passing promises instead of resolved values. This has been refered to as "promise over the wire".

Informational Resources:

- https://gist.github.com/jacob-ebey/9bde9546c1aafaa6bc8c242054b1be26
- https://github.com/remix-run/remix/blob/main/decisions/0004-streaming-apis.md

Documentation Resources (better docs specific to remix are in the works):

- https://reactrouter.com/en/main/utils/defer
- https://reactrouter.com/en/main/components/await
- https://reactrouter.com/en/main/hooks/use-async-value
- https://reactrouter.com/en/main/hooks/use-async-error
