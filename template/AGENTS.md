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
- `app/actions/home-page.tsx` and `app/actions/document.tsx` render the route-owned starter UI
- `app/actions/public/` contains the browser runtime entry and interactive prompt button
- `app/routes.ts` defines the shared route contract used by server and browser modules for type-safe hrefs
- `app/router.ts` wires routes to route handlers
- `app/middleware/render.tsx` installs the request-scoped renderer used by actions
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and renderer
- Root `public/` contains static files served unchanged from the app root

## Browser And Static Files

- Put browser-reachable source in a `public/` directory inside `app/`, beside its narrowest owner, such as `app/actions/public/` or `app/actions/cart/public/`.
- Keep every local dependency of a browser module in one of those `public/` directories. The exceptions are `app/routes.ts`, which is browser-readable so modules can build type-safe links with `routes.*.href(...)`, and packages allowed by `app/assets.ts`.
- Put images, fonts, and other files that do not need compilation in the root `public/` directory. It is served from the root URL, so `public/favicon.svg` is available at `/favicon.svg`.

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
