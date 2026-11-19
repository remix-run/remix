Fixes for `remix/router`:

- Responses that resolve after their request was aborted have their bodies cancelled, so streaming work behind them, such as rendering a frame, stops.
- Router middleware sees the full `GET` response when a `GET` route serves a `HEAD` request. The body is now stripped after middleware runs.
- Inline `{ middleware, handler }` controller actions type their handler with their own action middleware.
- `RouterContext` and `MiddlewareContext` keep the types of the other middleware when the array contains a conditional entry like `...(isDev ? [logger()] : [])`.

See the [`@remix-run/fetch-router` changelog](https://github.com/remix-run/remix/blob/main/packages/fetch-router/CHANGELOG.md) for details.
