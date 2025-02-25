---
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

When using Lazy Route Disscovery (`future.v3_lazyRouteDiscovery`), Remix will now detect manifest version mismatches after a new deploy and trigger a document reload to sync up any active client sessions with the newly deployed version

- On navigations to undiscovered routes, this mismatch will trigger a document reload of the destination path
- On `fetcher` calls to undiscovered routes, this mismatch will trigger a document reload of the current path
- While performing Eager Route Discovery on rendered `<Link>` components, mismatches will result in a no-op