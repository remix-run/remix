---
"@remix-run/css-bundle": patch
"@remix-run/dev": patch
---

Decouple the `@remix-run/dev` package from the contents of the `@remix-run/css-bundle` package.

The contents of the `@remix-run/css-bundle` package are now entirely managed by the Remix compiler. Even though it's still recommended that your Remix dependencies all share the same version, this change ensures that there are no runtime errors when upgrading `@remix-run/dev` without upgrading `@remix-run/css-bundle`.
