---
"@remix-run/dev": patch
---

Vite: Performance profiling

Run `remix vite:build --profile` to generate a `.cpuprofile` that can be shared or uploaded to speedscope.app

In dev, press `p + enter` to start a new profiling session or stop the current session.
If you need to profile dev server startup, run `remix vite:dev --profile` to initialize the dev server with a running profiling session.

For more, see the new docs: Vite > Performance
