# %%RMX_APP_DISPLAY_NAME%% Agent Guide

This app was scaffolded with `remix new`. Use these conventions when continuing to build it out.

## Commands

```sh
npm i
npm run start
npm test
npm run typecheck
```

## Building Features

Refer to ./.agents/skills/remix/SKILL.md

## Starter Layout

- `app/actions/controller.tsx` owns the top-level route actions
- `app/routes.ts` defines the route contract
- `app/router.ts` wires routes to route handlers
- `app/middleware/render.tsx` installs the request-scoped renderer used by actions
- `app/ui/` holds the shared document shell and home page UI
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and renderer
- `app/public/entry.ts` starts the browser runtime
- `public/static/` contains static files served unchanged from the app root

## Browser And Static Files

- Put browser-reachable source in a `public/` directory beside its narrowest owner, such as `app/ui/public/` or `app/actions/cart/public/`.
- Keep every local dependency of a browser module in a `public/` directory. `app/routes.ts` and packages allowed by `app/assets.ts` are the exceptions.
- Put images, fonts, and other files that do not need compilation in `public/static/`. They are served from the root URL, so `public/static/favicon.svg` is available at `/favicon.svg`.

## Route Ownership

- Start from `app/routes.ts` and map each route to the narrowest owner on disk.
- Put top-level route actions in `app/actions/controller.tsx`.
- Add `app/actions/<route-key>/controller.tsx` for nested route maps that need their own actions or middleware.
- Keep route-owned page modules next to the route that owns them.
- Move shared UI to `app/ui/`, not `app/actions/`.

## Build-Out Notes

- This starter intentionally begins small; add directories like `app/data/` and `test/` only when you need them.
- Prefer putting code in the narrowest owner before introducing shared modules.
- Avoid generic dumping-ground directories like `app/lib/` or `app/components/`.
