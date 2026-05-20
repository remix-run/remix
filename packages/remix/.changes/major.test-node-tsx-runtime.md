BREAKING CHANGE: `remix test` and `remix/test` now use Remix's internal `node-tsx` loader instead of the `tsx` package.

TypeScript module loading now more closely follows Node's built-in TypeScript semantics. Remix only adds JSX syntax support for `.tsx` files, so resolution and runtime behavior otherwise follow Node.
