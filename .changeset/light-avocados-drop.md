---
"@remix-run/server-runtime": patch
---

fix: Properly categorize internal framework-thrown error Responses as error boundary errors

Previously there was some ambiguity around _"thrown Responses go to the `CatchBoundary`"_.
The `CatchBoundary` exists to give the _user_ a place to handle non-happy path code flows
such that they can throw Response instances from _their own code_ and handle them in a
`CatchBoundary`. However, there are a handful of framework-internal errors that make
sense to have a non-500 status code, and the fact that these were being thrown as Responses
was causing them to go into the CatchBoundary, even though they were not user-thrown.

With this change, anything thrown by the framework itself (`Error` or `Response`) will
go to the `ErrorBoundary`, and any user-thrown `Response` instances will go to the
`CatchBoundary`. Thereis one exception to this rule, which is that framework-detected
404's will continue to go to the `CatchBoundary` since users should have one single
location to handle 404 displays.

The primary affected use cases are scenarios such as:

- HTTP `OPTIONS` requests (405 Unsupported Method )
- `GET` requests to routes without loaders (400 Bad Request)
- `POST` requests to routes without actions (405 Method Not Allowed)
- Missing route id in `_data` parameters (403 Forbidden)
- Non-matching route id included in `_data` parameters (403 Forbidden)
