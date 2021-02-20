# History of Changes

This is a history of changes to [Remix](https://remix.run).

## Unreleased

### Improvements

- Added `@remix-run/dev` package for all dev-specific functions

### Breaking Changes

- Removed `@remix-run/cli` package. Use `@remix-run/dev` instead

## 0.13.1 - Thu Feb 18 2021

### Bug Fixes

- Added `css:` import type

## 0.13.0 - Wed Feb 17 2021

### Breaking Changes

- Renamed `entry-browser.js` to `entry.client.js` and `entry-server.js` to `entry.server.js`

### Improvements

- Added support for excluding `*.client.js` files from the server bundles and `*.server.js` files from the browser bundles
- Added `css:` imports with postcss processing
- Added `useMatches()` hook to get access to the layout's route matches and data
- Added Route Module `handle` export to create application layout conventions
- Added `action` to `usePendingFormSubmit()`

### Bug Fixes

- Fixed 404 pages
- Fixed using non-HTML elements (e.g. `FormData`, `URLSearchParams`) with `useSubmit`
- Fixed using Open Graph tags with route `meta` function

## 0.12.0 - Thu Feb 11 2021

### Improvements

- Added `url:` import assertion to import, hash, and emit static files to the browser build directory.
- Added route module `links` export and `<Links>`component to add `<link>` elements to the the document for specific routes
- Added @remix-run/react `block` to block asset links on script transitions
- Added `{ page: pathname }` links to prefetch assets to other pages the user might visit
- Added automatic stylesheet link blocking on script transitions to follow normal browser behavior on document transitions
- JavaScript modules no longer cause waterfall of import requests, all scripts are fetched in parallel with `modulepreload`
- Stylesheet links are automatically added as "preload" to give higher priority to speed up initial render while JavaScript modules continue to download
- Removed manifest request on every transition
- Added `useSubmit` and `useFormAction` hooks
- Added support for `<button formAction>` and `<input formAction>` as well
  as `formMethod` and `formEnctype`
- Automatically pass `Set-Cookie` headers from loaders and parent routes
  through to entry on document requests
- Accept `null` as argument to `cookie.parse()`

### Breaking Changes

- Leaf route determines headers on document requests instead of aggregating
  headers from all routes
- Removed conventional route css files and global.css in lieu of `links` API

## 0.11.1 - Fri Feb 05 2021

### Improvements

- Added `HeadersFunction` and `MetaFunction` exports to `@remix-run/data` to allow typing of route `headers()` and `meta()` functions

### Bug Fixes

- Added `@types/cookie` as a regular dependency since `createCookie` and `createSessionStorage` rely on it
- Fixed `redirect()` default status code when headers are used as the 2nd arg

## 0.11.0 - Wed Feb 03 2021

### Improvements

- Added `SessionStorage` interface for managing sessions at the route level instead
  of globally using some cloud provider middleware
- Added several built-in `SessionStorage` providers including:
  - `createCookieSessionStorage`
  - `createFileSessionStorage`
  - `createMemorySessionStorage`
- Added `createSessionStorage` for easily implementing the `SessionStorage` interface using `SessionIdStorageStrategy`
  using any database
- Added `Cookie` interface and `createCookie` API for handling cookies, including
  support for signed cookies
- Added `session.has(name)`

### Breaking Changes

- Removed `session.destroy()` method, use `storage.destroySession(session)` instead
- Removed `session` arg from route `loader`s and `action`s
- Removed `enableSessions` arg from `createRequestHandler`. Sessions are now handled
  at the route level instead of in platform middleware.

## 0.10.4 - Wed Jan 27 2021

- Fixed Vercel starter deployments

## 0.10.2 - Wed Jan 27 2021

- Fixed srcset return string

## 0.10.1 - Wed Jan 27 2021

- Fixed layout file names on windows

## 0.10.0 - Wed Jan 27 2021

### Improvements

- Consolidated multiple layout APIs into one: `root.ts`
- Added response init support to `redirect()` helper
- Added easier status support to `json()` helper
- Added `img:` imports to import and process images

### Bug Fixes

- Fixed nested loader errors server rendering in a parent error boundary instead of it's own

### Breaking Changes

- Removed `global-loader`, changed to a normal `export function loader(){}` on `root.ts` route.
- Removed `<Remix ErrorBoundary>`, changed to a normal `export function ErrorBoundary(){}` on `root.ts` route.
- Removed `<Remix children={<App/>}>`, rename `App.ts` to `app/root.ts`
- Removed `useGlobalData` hook, use `useRouteData` in `root.ts`.
- Removed `<Routes />`, use React Router `<Outlet/>` in `root.ts`
- Removed `parseFormBody` helper. Use `new URLSearchParams(await request.text())` or (future) `await request.formData()` instead.

## 0.9.1 - Fri Jan 15 2021

### Bug Fixes

- Added a fix for deleting/renaming routes in dev mode

## 0.9.0 - Thu Jan 14 2021

### Improvements

- Added error handling for both render and loader errors
- Adds `loader` and `action` exports to route modules
- Assets are now served from the app server in development, instead of a
  separate asset server

### Breaking Changes

- Removes `data` directory (and `dataDirectory` from `remix.config.js`)
- Renames `data/global.js` to `app/global-data.js`

## 0.8.3 - Sun Dec 13 2020

### Bug fixes

- fixed `<Form>` on Vercel

## 0.8.2 - Fri Dec 12 2020

### Bug fixes

- Stopped hashing server bundle files so deployments work on Vercel

## 0.8.1 - Fri Dec 11 2020

### Improvements

- Added @remix-run/vercel adapter to deploy to Vercel
- Added @remix-run/architect adapter to deploy to AWS with Architect
- Added React 17 and new JSX transform support

### Bug Fixes

- Can pass `ref` to `<Form/>`
- Browser module names no longer cause problems for hosts (no longer write to `public/_shared/node_modules`)
- Fixed `Loader` and `Action` types for data modules
- Fixed dependency declarations so apps can use different React versions (16.8+, 17.x+)

## 0.8.0 - Wed Nov 25 2020

### Improvements

- Adds a `<Form>` component and `usePendingFormSubmit()` hook to
  `@remix-run/react` for data mutations
- Adds support for form actions in loaders. Loaders now have two possible
  exports: `loader` and `action`. `loader` is used on `GET` requests. `action`
  is called on `POST`, `PUT`, `PATCH`, and `DELETE` mutations.
- Adds `usePendingLocation`
- Adds `usePendingFormSubmit`
- Adds `parseFormBody(request)`
- Adds `request` property passed to loaders and actions
- Adds `{ session }` property to data loaders and actions
- Adds support for importing `.json` files.
- Ignore node built-ins when building browser bundles. Use `browser` field in
  package.json for packages that publish browser-ready shims.
- Adds support for `.ts` and `.tsx` extensions on `routes/404` and `routes/500`

### Bug Fixes

- Fixed error when rendering 500 pages
- Removed unused `rollup-plugin-postcss`
- Fixed browser transitions not sending search params to the loader
- redirects don't follow the redirects in the browser anymore, avoiding extra requests

### Breaking Changes

- removes `useLocationPending` removed in favor of `usePendingLocation`
- loader `url` property removed in favor of `request`
- Renamed the `loaders` directory to `data`. Also, `loadersDirectory` is now
  `dataDirectory` in `remix.config.js`.
- Removed support for default exports in data loaders. They should all export
  `loader` and/or `action` functions now.
- Removed `notFound` helper from `@remix-run/loader` because it was confusing.
  Use `json(null, { status: 404 })` (or something other than `null`, depending
  on what you want for data) instead.

## 0.7.0 - Fri Nov 13 2020

### Improvements

- Treat data loader redirects the same in client-side transitions as we do in
  HTML requests.
- Added ability to pass a function into `remix.config.mdx = (attrs, filename) => {}`
- Various dev server improvements, decoupling it from node and simplifying the
  process model by relying on reloading the process when files change.

### Bug Fixes

- Fixed "MaxListenersExceedWarning" warning in dev

### Breaking Changes

- Default to production mode in `remix build`
- Default to production mode when running the server

## 0.6.2 - Fri Oct 30 2020

### Bug Fixes

- Second attempt at fixing the build on Windows machines

## 0.6.1 - Thu Oct 29 2020

### Bug Fixes

- Fix the build on Windows machines to not externalize local modules
- Temporarily disable caching fetches in node for now. It seems like there are
  bugs there...

## 0.6.0 - Wed Oct 28 2020

### Improvements

- Minify production builds using terser
- Add caching and `{ compress: false }` to `global.fetch` in node
- Add more strict return type to `createRequestHandler` in `@remix-run/express`
- Add `GetLoadContext` interface to `@remix-run/express`

## 0.5.2 - Tue Oct 27 2020

### Improvements

- Re-use data we already have for routes already on the page instead of making a
  separate data request
- Preload stylesheets in 1 request instead of 2
- Changed `__remix_data` and `__remix_manifest` endpoints to `/_remix/data` and
  `/_remix/manifest` respectively to shorten the visible portion of the URL
  pathname in Chrome's network tab

### Bug Fixes

- Use the right return type for `<RemixBrowser>` and `<RemixServer>`

## 0.5.1 - Fri Oct 23 2020

### Features

- Added TypeScript declarations
- Added `fetch` globals to server code including `entry-server.js` and data
  loaders

## 0.5.0 - Thu Oct 22 2020

### Improvements

- `node_modules` dependencies now load in their own bundle which should improve
  caching

### Bug Fixes

- Fixed route data not updating when params change

### Breaking Changes

- Renamed `data` directory back to `loaders`
- Return data directly (instead of `useState` tuple) from `useGlobalData` and
  `useRouteData`
- Default to `NODE_ENV=development` in `remix build`

## 0.4.1 - Mon Oct 19 2020

## Features

- Added Cache-Control to `/__remix_manifest` responses for better cacheability
  ([#4](https://github.com/remix-run/remix/issues/4))
- Remove location-based browser data cache, use built-in caching instead
  ([#15](https://github.com/remix-run/remix/issues/15))
- Automatically reload the page when we detect the build has changed
  ([#7](https://github.com/remix-run/remix/issues/7))
- Added `useBeforeUnload` hook for saving state immediately before reload
- Added `json` and `redirect` helpers to `@remix-run/loader`

## Bug Fixes

- Don't call `/__remix_data` for routes that don't have data loaders
  ([#3](https://github.com/remix-run/remix/issues/3))

## 0.4.0 - Thu Oct 15 2020

### Features

- Add support for `.md` and `.mdx` in conventional routes (`app/routes`)
- Wait for CSS `<link>` tags to load before transitioning to a new route
  ([#16](https://github.com/remix-run/remix/pull/16))

### Bug Fixes

- Fixed code splitting causing errors with shared chunks in development
- Fixed dev server crash when renaming/deleting CSS files
  ([#11](https://github.com/remix-run/remix/issues/11))

### Breaking Changes

- Default to development mode when running the server
  ([#10](https://github.com/remix-run/remix/issues/10))

## 0.3.0 - Tue Oct 13 2020

### Features

- Added support for watching `.css` files in `remix run`

### Breaking Changes

- Moved styles from `app/styles` into `app/routes`
- Moved route data loaders from `data/loaders` to `data/routes`

## 0.2.0 - Wed Oct 07 2020

### Features

- Added `url` property to data loader arg
- Added support for `headers({ loaderHeaders, parentsHeaders })` function in route modules
- Added support for array initializer in `Headers`

### Bug Fixes

- Fixed storage/retrieval of falsy values from data loaders in client data cache

### Breaking Changes

- Renamed `allData` property on `meta()` arg to `parentsData` (to match
  `parentsHeaders` property on `headers()` arg)
- Removed `pathname` and `search` properties from data loader arg, use
  `url.pathname` and `url.search` instead
- Removed `redirect` from `@remix-run/loader`. Use `Response.redirect` instead
- Renamed `<RemixServer request>` to `<RemixServer url>`
