# History of Changes

This is a history of changes to [Remix](https://remix.run).

## Unreleased

### Features

- Added support for `headers({ loaderHeaders, parentsHeaders })` function in route modules
- Added support for array initializer in `Headers`

### Bug Fixes

- Fixed storage/retrieval of falsy values from data loaders in client data cache

### Breaking Changes

- Removed `redirect` from `@remix-run/loader`. Use `Response.redirect` instead
- Renamed `<RemixServer request>` to `<RemixServer url>`
