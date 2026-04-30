BREAKING CHANGE: Removed the `@remix-run/fetch-router/routes` export. Import route definitions and helpers from `@remix-run/routes` instead.

The `fetch-router` package now depends on `@remix-run/routes` for route map primitives like `Route` and `RouteMap`, keeping `fetch-router` focused on request dispatch.
