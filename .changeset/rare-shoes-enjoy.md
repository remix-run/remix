---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
---

Stabilize React Router APIs in Remix

- Adopt stabilized React Router APIs internally
  - Single Fetch: `unstable_dataStrategy` -> `dataStrategy`
  - Lazy Route Discovery: `unstable_patchRoutesOnNavigation` -> `patchRoutesOnNavigation`
- Stabilize public-facing APIs
  - Single Fetch: `unstable_data()` -> `data()`
  - `unstable_viewTransition` -> `viewTransition` (`Link`, `Form`, `navigate`, `submit`)
  - `unstable_flushSync>` -> `<Link viewTransition>` (`Link`, `Form`, `navigate`, `submit`, `useFetcher`)
