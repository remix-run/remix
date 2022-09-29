---
"remix": patch
"@remix-run/dev": patch
---

bump esbuild to 0.15.9 to fix an issue with spreading props followed by a key as well as a `jsx name collision edge case` when using packages with the name `react` in them, like `@remix-run/react`
