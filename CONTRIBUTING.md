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

- `.changes/`: Directory containing change files for the next release
- `CHANGELOG.md`: A log of what's changed
- `package.json`: Package metadata and dependencies
- `README.md`: Information about the package
- `src/`: The package's source code

When you make changes to a package, please make sure you add a few relevant tests and run the whole test suite to make sure everything still works. Then, [add a change file](#adding-a-change-file) describing your changes and [make a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). We will take a look at it as soon as we can.

### Adding a Change File

When making changes to a package, create a markdown file in the package's `.changes/` directory following this naming convention:

```
[major|minor|patch].short-description.md
```

- `major` - Breaking changes for v1.x+ packages
- `minor` - Breaking changes for v0.x packages, new features
- `patch` - Bug fixes

#### Examples

- `major.change-something.md` - Breaking change for v1.x+ packages
- `minor.change-something.md` - Breaking change for v0.x packages
- `minor.add-something.md` - New feature
- `patch.fix-something.md` - Bug fix

#### Content Format

Write your change as a bullet point (without the leading `-` or `*`). This content will be added to the CHANGELOG during release.

```markdown
Add support for X feature

This is an optional longer explanation that will be indented
under the main bullet point in the CHANGELOG.
```

For breaking changes in v0.x packages, any change files that begin with `BREAKING CHANGE: ` will be hoisted to the top of the release notes:

```markdown
BREAKING CHANGE: Renamed `foo` option to `bar`

Migration: Update your config to use `bar` instead of `foo`.
```

#### Validation

Change files are automatically validated in CI. You can also validate them locally:

```sh
pnpm changes:validate
```

## Releases

Releases are automated via the [changes-version-pr workflow](/.github/workflows/changes-version-pr.yaml) and [publish workflow](/.github/workflows/publish.yaml).

1. **You push changes to `main`** with change files in `packages/*/.changes/`

2. **A "Version Packages" PR is automatically opened** (or updated if one exists)

   The PR contains:

   - Updated `package.json` versions
   - Updated `CHANGELOG.md` files
   - Deleted change files

   This PR should not be edited manually. If you need to make changes, modify the change files and/or scripts in `main` to trigger an update to the PR.

3. **When you merge the PR**, the publish workflow runs (it runs on every push to `main` and checks for change files). Since the change files have been deleted, it publishes all unpublished packages to npm, then creates git tags and GitHub releases based on what was actually published.

### Manual Versioning

The "Version Packages" PR simply automates the `pnpm changes:version` command. If needed, you can run this command manually. This will update the `package.json` versions, `CHANGELOG.md` files, and delete the change files. It will then commit the result.

```sh
pnpm changes:version
```

You can skip committing the changes by using the `--no-commit` flag. This will leave the changes in a staged state for you to review and commit manually. The command will also output the commit message that would have been used.

```sh
pnpm changes:version --no-commit
```

Tags and GitHub releases are created automatically by the publish workflow after successful npm publish.

### Prerelease Mode for `remix`

The `remix` package supports prerelease mode via an optional `.changes/prerelease.json` file:

```json
{
  "tag": "alpha"
}
```

This is only supported for `remix` because it's the only package that needs to publish prereleases alongside an existing stable version on npm. All other packages in this monorepo are new and publish directly as `latest`.

#### Bumping `remix` prerelease versions

While in prerelease mode, add change files as normal. The prerelease counter increments (e.g. `3.0.0-alpha.1` → `3.0.0-alpha.2`). Changelog entries still get proper "Major Changes" / "Minor Changes" / "Patch Changes" sections, but the bump type is otherwise ignored—only the prerelease counter is bumped.

#### Transitioning between `remix` prerelease tags

To transition between tags (e.g. `alpha` → `beta`):

1. Update `.changes/prerelease.json` to the new tag
2. Add a change file describing the transition

Version resets to the new tag (e.g. `3.0.0-alpha.7` → `3.0.0-beta.0`). The bump type is for changelog categorization only—by convention, use `patch`.

#### Graduating `remix` to stable

To release the stable version:

1. Delete `.changes/prerelease.json`
2. Add a change file describing the stable release

The prerelease suffix is stripped (e.g. `3.0.0-rc.7` → `3.0.0`). The bump type is for changelog categorization only—by convention, use `major` for a major release announcement.
