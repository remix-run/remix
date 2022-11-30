---
"remix": patch
"@remix-run/dev": patch
---

bump esbuild to fix an issue with spreading props followed by a key as well as a `jsx name collision edge case` when using packages with the name `react` in them, like `@remix-run/react`.

it also utilizies esbuild's native yarn pnp compatibility instead of using `@yarnpkg/esbuild-plugin-pnp`
