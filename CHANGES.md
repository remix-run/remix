# History of Changes

This is a history of changes to [Remix](https://remix.run).

## Unreleased

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
