# `remix`

## 2.0.0

### Patch Changes

- Replace references to the old `migrate` command with the new `codemod` command ([#4646](https://github.com/remix-run/remix/pull/4646))
- Replace migrations with codemods. Specifically, `npx @remix-run/dev migrate` is now `@remix-run/dev codemod`. ([#4572](https://github.com/remix-run/remix/pull/4572))

  Under the hood, codemods are now written via Babel's Visitor API instead of jscodeshift.
  Also `replace-remix-magic-imports` is now faster as it no longer depends on a network connection
  and does not incur the overhead of spinning up workers for jscodeshift.

- chore: update @remix-run/web-fetch to 4.3.2 ([#4644](https://github.com/remix-run/remix/pull/4644))

  - fix: Memory leak caused by unregistered listeners. Solution was copied from a node-fetch pr.
  - fix: Add support for custom "credentials" value. Nothing is done with them at the moment but they pass through for the consumer of the request to access if needed.

- bump esbuild to fix an issue with spreading props followed by a key as well as a `jsx name collision edge case` when using packages with the name `react` in them, like `@remix-run/react`. ([#4301](https://github.com/remix-run/remix/pull/4301))

  it also utilizies esbuild's native yarn pnp compatibility instead of using `@yarnpkg/esbuild-plugin-pnp`

See the `CHANGELOG.md` in individual Remix packages for all changes.
