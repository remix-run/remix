Welcome to Remix! We're excited to have you contribute.

This guide will help you get started.

## Setting Up Your Environment

We develop Remix using [pnpm](https://pnpm.io) on Node 24.

If you're using [VS Code](https://code.visualstudio.com/), we recommend installing the [`node:test runner` extension](https://marketplace.visualstudio.com/items?itemName=connor4312.nodejs-testing) for a smooth testing experience.

Once that's set up, run `pnpm install` to get all the project dependencies.

## Testing

All tests run directly from source. This makes it easy to use breakpoint debugging when running tests. This also means you should not need to run a build before running the tests.

```sh
# Run all tests
$ pnpm test
# Run the tests for a specific package
$ pnpm --filter @remix-run/headers run test
```

## Building

All packages are built using a combination of tsc and esbuild.

```sh
# Build all packages
$ pnpm run build
# Build a specific package
$ pnpm --filter @remix-run/headers run build
```

All packages are published with TypeScript types along with both ESM and CJS module formats.

## Making Changes

Packages live in the [`packages` directory](https://github.com/remix-run/remix/tree/v3/packages). At a minimum, each package includes:

- `CHANGELOG.md`: A log of what's changed
- `package.json`: Package metadata and dependencies
- `README.md`: Information about the package
- `src/`: The package's source code

When you make changes to a package, please make sure you add a few relevant tests and run the whole test suite to make sure everything still works. Then, add a human-friendly description of your change in the changelog and [make a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). We will take a look at it as soon as we can.

## Releases

Cutting releases is a 2-step process:

- Update versions in package.json and the changelog and create a git tag (tagging)
- Publish new packages to npm and create a GitHub Release (publishing)

This repo includes a script for each step.

To update versions and create a tag, use `pnpm run tag-release <packageName> <releaseType>`. For example, to create a `minor` release of the `headers` package, run:

```sh
pnpm run tag-release headers minor
```

To publish the release you just tagged, use `pnpm run publish-release <tag>`. For example, if the tag that was created in the previous step was `headers@1.0.0`, you'd run `pnpm run publish-release headers@1.0.0`.

The publish step runs in GitHub Actions if you just push the tag to GitHub:

```sh
git push origin main --tags
```
