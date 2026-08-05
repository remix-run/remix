BREAKING CHANGE: `Route.href(params, searchParams)` now accepts an options object as its second argument. Move existing search parameters to `Route.href(params, { searchParams })`.

`Route.href()` also accepts a `baseURL` option for generating path-relative same-origin hrefs, and its `searchParams` option accepts both typed plain objects and `URLSearchParams`.
