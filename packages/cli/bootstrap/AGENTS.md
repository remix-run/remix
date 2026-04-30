# %%RMX_APP_DISPLAY_NAME%% Agent Guide

This app was scaffolded with `remix new`. Use these conventions when continuing to build it out.

## Commands

```sh
npm i
npm run start
npm test
npm run typecheck
```

## Starter Layout

- `app/controllers/home.tsx` owns the home page
- `app/controllers/auth.tsx` owns the auth page
- `app/routes.ts` defines the route contract
- `app/router.ts` wires routes to route handlers
- `app/ui/` holds the shared document and layout wrappers
- `app/utils/render.tsx` centralizes HTML response rendering

## Route Ownership

- Start from `app/routes.ts` and map each route to the narrowest owner on disk.
- Keep simple pages in flat files like `app/controllers/home.tsx` and `app/controllers/auth.tsx`.
- Promote a route into a controller folder with `controller.tsx` only when it gains nested routes, multiple actions, or route-owned modules.
- Keep route-owned page modules next to the route that owns them.
- Move shared UI to `app/ui/`, not `app/controllers/`.

## Build-Out Notes

- This starter intentionally begins small; add directories like `app/data/`, `app/middleware/`, `public/`, and `test/` only when you need them.
- Prefer putting code in the narrowest owner before introducing shared modules.
- Avoid generic dumping-ground directories like `app/lib/` or `app/components/`.
