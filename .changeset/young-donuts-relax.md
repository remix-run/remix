---
"@remix-run/dev": minor
"@remix-run/express": minor
"@remix-run/node": minor
"@remix-run/server-runtime": minor
---

Adds support for "middleware" on routes to give you a common place to run before and after your loaders and actions in a single location higher up in the routing tree. The API we landed on is inspired by the middleware API in [Fresh](https://fresh.deno.dev/docs/concepts/middleware) since it supports the concept of nested routes and also allows you to run logic on the response _after_ the fact.

This feature is behind a `future.unstable_middleware` flag at the moment, but major API changes are not expected and we believe it's ready for production usage. This flag allows us to make small "breaking" changes if users run into unforeseen issues.
