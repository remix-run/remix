This is the monorepo for Remix, a cutting edge web framework. All packages are contained in the `./packages` dir.

In addition to this file, see `CONTRIBUTING.md` for further guidelines about developing in this repository.

## Development

You should be able to run the tests without building first.

```sh
# Run all tests
$ pnpm test
# Run the tests for a specific package
$ pnpm --filter @remix-run/headers run test

# Build all packages
$ pnpm run build
# Build a specific package
$ pnpm --filter @remix-run/headers run build
```

## Testing

- Use `node:test` and `describe/it` style to organize test suites
- Make assertions using `node:assert/strict`

## Releasing

The release process is a two-step process. First, we tag a release. Then, we publish it.

To cut a release:

```sh
# To bump the headers package to the next minor release
$ pnpm run tag-release headers minor
# Then publish it using the newly created tag
$ pnpm run publish-release headers@1.1.0
```

## Code Style

- Prefer `let` for all variables, unless they are defined in global or module-level scope
- Only make comments to explain unusual code, do not comment on obvious code
