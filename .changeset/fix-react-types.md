---
"@remix-run/server-runtime": patch
---

Fix typing issues when using React 17 stemming from `@remix/server-runtime` including `@types/react` as a `devDependency` when it doesn't actually do anything React-specific and was just re-exporting `ComponentType` in values such as `CatchBoundaryComponent`/`ErrorBoundaryComponent`/`V2_ErrorBoundaryComponent`.  These types are more correctly exported from `@remix-run/react` which is React-aware so that is the correct place to be importing those types from.  In order to avoid breaking existing builds, the types in `@remix/server-runtime` have been loosened to `any` and `@deprecated` warnings have been added informing users to switch to the corresponding types in `@remix-run/react`.
