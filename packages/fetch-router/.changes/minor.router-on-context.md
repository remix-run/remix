Expose `context.router` on request context

Each router request context now gets the owning `Router` assigned as `context.router` by `createRouter()` when `fetch()` is called. This lets framework helpers read router state directly from `RequestContext` instead of requiring app-level middleware to store the router in `context.storage`.
