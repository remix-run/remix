Welcome to `remix-the-web`! We're excited to have you contribute.

This guide will help you get started.

## Setting Up Your Environment

To get started, you'll need `pnpm`. If you don't have it yet, you can [install `pnpm` here](https://pnpm.io/installation).

If you're using [VS Code](https://code.visualstudio.com/), we recommend installing the [`node:test runner` extension](https://marketplace.visualstudio.com/items?itemName=connor4312.nodejs-testing) for a smooth testing experience.

Once that's set up, run `pnpm install` to get all the project dependencies. You can then run `pnpm build` to build the project and `pnpm test` to run all tests.

## Making Changes

All our packages live in the [`packages` directory](https://github.com/mjackson/remix-the-web/tree/main/packages). At a minimum, each package typically includes:

- `CHANGELOG.md`: A log of what's changed.
- `package.json`: Package metadata and dependencies.
- `README.md`: Information about the package.

When you make changes to a package, please make sure you add a few relevant tests and run the whole test suite to make sure everything still works. Then, add a human-friendly description of your change in the changelog and [make a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). We will take a look at it as soon as we can.

## Releases

Cutting releases is a 2-step process:

- Update versions in package.json, jsr.json (if applicable), and the changelog and create a git tag
- Publish new packages to npm/JSR and create a GitHub Release

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
