---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
---

Hot Module Replacement and Hot Data Revalidation

- Requires `unstable_dev` future flag to be enabled
- HMR provided through React Refresh

Features:

- HMR for component and style changes
- HDR when loaders for current route change

Known limitations for MVP:

- Only implemented for React via React Refresh
- No `import.meta.hot` API exposed yet
- Revalidates _all_ loaders on route when loader changes are detected
- Loader changes do not account for imported dependencies changing
