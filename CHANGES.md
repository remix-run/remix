# History of Changes

This is a history of changes to [Remix](https://remix.run).

## Unreleased

### Improvements

- Re-use data we already have for routes already on the page instead of making a
  separate data request
- Preload stylesheets in 1 request instead of 2

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
