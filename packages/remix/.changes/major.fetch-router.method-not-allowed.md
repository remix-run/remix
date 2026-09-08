BREAKING CHANGE: `remix/router` now returns `405 Method Not Allowed` with an `Allow` header when a URL matches a route but the request method does not. These requests previously reached `defaultHandler`, which returned 404 by default. Register an `ANY` route if you need a custom handler for every method at that URL.

`GET` routes now also serve `HEAD` requests with the same status and headers and an empty body. Explicit `HEAD` routes still take precedence. See the [router release notes](https://github.com/remix-run/remix/blob/main/packages/fetch-router/CHANGELOG.md#v0220) (see #11767).
