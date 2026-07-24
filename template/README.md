# %%RMX_APP_DISPLAY_NAME%%

A minimal Remix application starter with a home page.

## Starter Shape

- `app/actions/controller.tsx` owns the top-level route actions.
- `app/routes.ts` defines the shared route contract used by server and browser modules for type-safe hrefs.
- `app/router.ts` wires routes to handlers.
- `app/middleware/render.tsx` installs the request-scoped renderer used by actions.
- `app/ui/` holds the shared document shell and home page UI.
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and renderer.
- `app/public/entry.ts` starts the browser runtime.
- Root `public/` contains static files served unchanged from the app root.

## Browser And Static Files

Browser-reachable source lives in `public/` directories inside `app/`, beside the code that owns it. For example, the starter's interactive prompt button lives in `app/ui/public/`. The asset server compiles files in these directories and requires their local dependencies to follow the same convention. The shared `app/routes.ts` contract is also browser-readable so these modules can build type-safe links with `routes.*.href(...)`; allowed packages are the other exception.

Static images, fonts, and other files that do not need compilation belong in the root `public/` directory. That directory is mounted at the root URL, so `public/favicon.svg` is served as `/favicon.svg`.

## Growing The App

- Put top-level route actions in `app/actions/controller.tsx`.
- Add `app/actions/<route-key>/controller.tsx` when a nested route map needs its own actions or middleware.
- Add directories like `app/data/` or `test/` when the app actually needs them.
- Move shared UI into `app/ui/` once more than one route needs it.

## Commands

```sh
npm i
npm run start
npm test
npm run typecheck
```
