Migrated `@remix-run/test` from the `tsx` package to Remix's internal `@remix-run/node-tsx` module loader.

BREAKING CHANGE: `.ts` and `.tsx` module loading in `@remix-run/test` now more closely tracks Node's built-in `.ts` support. Remix only adds JSX syntax support for `.tsx` files, so resolution and runtime behavior should otherwise follow Node's built-in TypeScript semantics.
