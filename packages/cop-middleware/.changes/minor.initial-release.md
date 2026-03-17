Add the initial release of `@remix-run/cop-middleware`.

- Expose `cop(options)` for browser-focused cross-origin protection using `Sec-Fetch-Site`
  with `Origin` fallback.
- Support trusted origins, explicit insecure bypass patterns, and custom deny handlers.
- Allow apps to layer `cop()` ahead of `session()` and `csrf()` when they want both
  browser-origin filtering and token-backed CSRF protection.
