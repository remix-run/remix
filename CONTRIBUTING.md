Welcome to `remix-the-web`!

## Setting Up Your Environment

First off, [install `pnpm`](https://pnpm.io/installation) somewhere globally on your machine. It's the tool we use to manage dependencies and run tasks in this workspace.

If you're using [VS Code](https://code.visualstudio.com/) you should also install [the `node:test runner` extension](https://marketplace.visualstudio.com/items?itemName=connor4312.nodejs-testing) which provides an integrated experience when running the tests.

When you've done that, run `pnpm install` to install all dependencies and run a build. You can also run `pnpm test` to run all tests in the repo.

## Making Changes

You can find all packages in [the `packages` directory](https://github.com/mjackson/remix-the-web/tree/main/packages). Inside each package you'll find a few common files including:

- `CHANGELOG.md`
- `package.json`
- `README.md`

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
