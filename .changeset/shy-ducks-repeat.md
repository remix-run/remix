---
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

- Fog of War: Simplify implementation now that React Router handles slug/splat edge cases and tracks previously disscovered routes (see https://github.com/remix-run/react-router/pull/11883)
  - This changes the return signature of the internal `__manifest` endpoint since we no longer need the `notFoundPaths` field
- Fog of War: Update to use renamed `unstable_patchRoutesOnNavigation` function in RR (see https://github.com/remix-run/react-router/pull/11888)