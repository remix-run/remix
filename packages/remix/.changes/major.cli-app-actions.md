BREAKING CHANGE: Remix app scaffolding, `remix doctor`, and `remix routes` now use `app/actions` with controller files only. The old `app/controllers` directory name has been replaced by `app/actions`, and root route actions should no longer live in standalone files.

Move route controllers from `app/controllers` to `app/actions`, consolidate root route actions into `app/actions/controller.tsx`, and map nested route maps explicitly in `app/router.ts` with one `router.map(...)` call per route map. Controller middleware applies only to direct actions owned by that controller.
