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

#### Examples

- `major.breaking-api-change.md` - Breaking change requiring major version bump
- `minor.add-new-feature.md` - New feature requiring minor version bump
- `patch.fix-bug.md` - Bug fix requiring patch version bump

#### Content Format

Write your change as a bullet point (without the leading `-` or `*`). This content will be added to the CHANGELOG during release.

**Simple change:**

```markdown
Add support for X feature
```

**Multi-line change:**

```markdown
Add support for X feature

This is a longer explanation that will be indented
under the main bullet point in the CHANGELOG.
```

#### Validation

Change files are automatically validated in CI. You can also validate them locally:

```sh
pnpm changes:validate
```

## Releases

Cutting releases is a multi-step process:

1. **Preview** - See what will be released
2. **Version** - Update versions and create commit/tags locally
3. **Push** - Push to GitHub (triggers CI to publish to npm)

### Preview a Release

To see which packages have changes and preview the release:

```sh
pnpm changes:preview
```

This shows:

- Which packages will be released with version bumps
- CHANGELOG additions
- Git tags that will be created
- Commit message

### Version a Release

When ready to release, update versions and create the commit and tags locally:

```sh
pnpm changes:version
```

This will:

- Validate all change files
- Update `package.json` versions
- Update `CHANGELOG.md` files
- Delete processed change files
- Create a git commit
- Create git tags

If you want to review the file changes before committing:

```sh
pnpm changes:version --no-commit
```

This updates the files but skips git operations. After reviewing, the script will show you the exact git commands to run to create the commit and tags.

### Push the Release

Push the release commit and tags to GitHub:

```sh
git push && git push --tags
```

GitHub Actions will automatically publish the tagged packages to npm and create GitHub Releases.
