## Intro

Remix is a web framework.

## Development

Development uses Node.js 24. All tests should run without requiring a build first.

```sh
# Run the build
$ pnpm run build
# Build a specific package
$ cd packages/headers && pnpm run build

# Run the tests
$ pnpm test
# Run the tests for a specific package
$ cd packages/headers && pnpm test
```
