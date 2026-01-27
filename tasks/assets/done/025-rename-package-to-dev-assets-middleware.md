### Rename package `assets-middleware` → `dev-assets-middleware`

Renamed the package to make it clear this is for development only.

**Changes:**

- `packages/assets-middleware` → `packages/dev-assets-middleware`
- Package name: `@remix-run/dev-assets-middleware`
- Updated all imports in demo app
- Updated error message in fetch-router
- Updated JSDoc examples, README, and plan.md references

The future `@remix-run/assets-middleware` will be the lightweight prod package that serves built assets from a manifest.
