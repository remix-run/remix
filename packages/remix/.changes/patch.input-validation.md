Stricter handling of untrusted input. Each of these rejects values that were previously accepted:

- `remix/node-fetch-server` responds with `400 Bad Request` to requests with a literal backslash in the URL path. Percent-encoded backslashes are still accepted.
- `createHref()` from `remix/route-pattern/href`, and the `href()` method of routes from `remix/routes`, throw a `CreateHrefError` when a pathname variable produces a standalone `.` or `..` segment, which could otherwise resolve to a different route.
- `bigint()` from `remix/data-schema/coerce` fails validation for strings longer than 4,096 characters.
