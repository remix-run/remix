BREAKING CHANGE: `remix test` and `remix/test` now use Remix's internal `node-tsx` loader instead of the `tsx` package.

Test modules are still transformed before execution, including JSX and TypeScript syntax that requires JavaScript output, but the loader is now maintained inside Remix through `remix/node-tsx`.
