# %%RMX_APP_DISPLAY_NAME%%

A minimal Remix application starter with a home page and an auth page.

## Starter Shape

- `app/actions/controller.tsx` owns the top-level route actions.
- `app/routes.ts` defines the route contract.
- `app/router.ts` wires routes to handlers.
- `app/ui/` holds the shared document and layout wrappers.
- `app/actions/render.tsx` centralizes HTML response rendering for controllers.
- `public/` contains static files served from the app root.

## Growing The App

- Put top-level route actions in `app/actions/controller.tsx`.
- Add `app/actions/<route-key>/controller.tsx` when a nested route map needs its own actions or middleware.
- Add directories like `app/data/`, `app/middleware/`, or `test/` when the app actually needs them.
- Move shared UI into `app/ui/` once more than one route needs it.

## Commands

```sh
npm i
npm run start
npm test
npm run typecheck
```
