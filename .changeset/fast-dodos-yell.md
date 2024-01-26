---
"@remix-run/dev": patch
---

Vite: fix "could not fast refresh" false alarm

HMR is already functioning correctly but was incorrectly logging that it "could not fast refresh" on internal client routes.
Now internal client routes correctly register Remix exports like `meta` for fast refresh,
which removes the false alarm.
