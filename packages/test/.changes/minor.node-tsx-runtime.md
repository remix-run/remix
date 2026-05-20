Migrated `@remix-run/test` from the `tsx` package to Remix's internal `@remix-run/node-tsx` module loader.

BREAKING CHANGE: `.ts`, `.tsx`, and `.jsx` module loading in `@remix-run/test` now uses Remix's internal `@remix-run/node-tsx` loader. Test modules are still transformed before execution, including JSX and TypeScript syntax that requires JavaScript output, but the loader is now maintained inside Remix.
