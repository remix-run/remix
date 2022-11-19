---
"remix": patch
"@remix-run/dev": patch
---

Replace `migration` scripts with `codemod`. Specifically, `npx @remix-run/dev migrate` is now `@remix-run/dev codemod`.

Under the hood, codemods are now written via Babel's Visitor API instead of `jscodeshift`.
This makes some scripts much faster as it a) no longer depends on a network connection, and b)
and no longer incurs the overhead of spinning up workers for `jscodeshift`.
