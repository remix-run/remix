Add the initial release of `@remix-run/cors-middleware`.

- Expose `cors(options)` for standard CORS response headers and preflight handling in Fetch API servers.
- Support static and dynamic origin policies, credentialed requests, allowed and exposed headers, preflight max-age, and private network preflights.
- Allow apps to either short-circuit preflight requests or continue them into custom `OPTIONS` handlers.
