---
"@remix-run/react": minor
"@remix-run/dev": patch
---

Faster server export removal for routes when `unstable_dev` is enabled.

Also, only render modulepreloads on SSR.
Do not render modulepreloads when hydrated.
