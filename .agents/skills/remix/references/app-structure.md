# App Structure

Read when adding a route area, placing new files, or deciding whether code should be shared. For route-map semantics, see [routing and controllers](routing-and-controllers.md) and the installed `src/fetch-router/README.md`.

## Extend the Existing App

These are conventions for new code, not a mandate to rename established directories. Keep the starter small: create data, middleware, test-helper, and scratch directories only when needed.

```text
app/
  actions/
    controller.tsx          # Direct leaf routes in the root route map
    document.tsx            # Route-owned document shell
    public/entry.ts         # Browser runtime entry
    account/
      controller.tsx        # Direct leaves of routes.account
      settings/
        controller.tsx      # Direct leaves of routes.account.settings
  assets.ts                 # Server-side asset pipeline
  data/                     # Tables, queries, persistence setup
  middleware/               # Request lifecycle concerns
  ui/                       # UI shared across route areas
  routes.ts                 # Shared server/browser URL contract
  router.ts                 # Middleware and controller registration
public/                     # Static files served unchanged
```

- Name action directories after route-map keys, not URL path segments. Register each nested controller explicitly in `app/router.ts`.
- Keep page components and helpers beside the controller that owns them. Promote UI to `app/ui/` only when route areas share it.
- Put browser-reachable source in a `public/` directory within its narrowest owner, such as `app/actions/account/public/` or `app/ui/public/`. This differs from root `public/`, which holds static files.
- Keep schema, queries, and runtime database setup in `app/data/`. Put migration artifacts and local database files under root `db/`, not alongside browser source.
- Put local tests beside their subject. Use root `test/` for shared fixtures and integration helpers, and `tmp/` for disposable uploads, caches, or local session files. Production persistence needs deployment-appropriate durable storage.

## Ownership Decisions

| Code does…                                            | Owner                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Assemble a route's HTML, redirect, headers, or status | Controller action                                            |
| Render UI used by one route area                      | That route area under `app/actions/`                         |
| Render UI shared across route areas                   | `app/ui/`                                                    |
| Enrich, guard, or wrap request handling               | `app/middleware/`                                            |
| Read or write persisted data                          | `app/data/`                                                  |
| Pure formatting/parsing shared across layers          | Focused `app/utils/<topic>.ts`, when no clearer owner exists |

Avoid introducing generic `app/lib/`, `helpers.ts`, or `common.ts` buckets. Do not add `app/controllers/` or a second shared-UI bucket named `app/components/` to a convention-based app.

Keep response assembly at the action boundary with `context.render(...)`. Extract useful pure helpers, not page-data intermediary types or custom renderer abstractions solely to move a render call elsewhere.

When a leaf route grows into a route map, move its behavior into the nested route-key controller and update the registration. Do not put nested route-map keys inside a controller's `actions` object.
