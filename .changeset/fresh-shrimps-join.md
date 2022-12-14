---
"remix": patch
"@remix-run/dev": patch
---

Support Typescript 4.9 features (like `satisfies`) in Remix `app/` code.

esbuild 0.15.13 added support for parsing TS 4.9 `satisfies`, so upgrading to esbuild 0.16.3 adds that ability to the Remix compiler.
