# History of Changes

This is a history of changes to [Remix](https://remix.run).

## Unreleased

### Improvements

- Adds `loader` and `action` exports to route modules

### Breaking Changes

- Removes `data` directory (and `dataDirectory` from `remix.config.js`)
- `data/global.js` is now `app/global-data.js`

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
