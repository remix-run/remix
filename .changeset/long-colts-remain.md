---
"remix": patch
"@remix-run/dev": patch
---

Replace migrations with codemods. Specifically, `npx @remix-run/dev migrate` is now `@remix-run/dev codemod`.

Under the hood, codemods are now written via Babel's Visitor API instead of jscodeshift.
Also `replace-remix-magic-imports` is now faster as it no longer depends on a network connection
and does not incur the overhead of spinning up workers for jscodeshift.
