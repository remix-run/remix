# Contributing to Remix

Thanks for contributing to Remix! There are many valuable ways to help, including reporting
bugs, improving documentation, proposing features, and submitting code.

This guide explains where each kind of contribution belongs and how to validate code changes
locally. Repository maintainers should also read [MAINTAINING.md](./MAINTAINING.md) for release
and publishing procedures.

## Reporting Bugs

[GitHub Issues](https://github.com/remix-run/remix/issues) are reserved for demonstrable,
reproducible bugs in Remix. Issues are not used for troubleshooting, Q&A, or Feature Requests.

Before opening an issue, make sure the behavior is caused by Remix
and is not a usage question or feature request.

Every bug report must include a **minimal**, **runnable** reproduction:

- **Minimal** means the reproduction contains only the code needed to demonstrate the problem.
  Do not link to a production application or a large existing codebase.
- **Runnable** means maintainers can install or open the reproduction and observe the problem
  without assembling code themselves.
- Reproductions should be provided as a small GitHub repository.
- Code snippets are not considered valid reproductions.

Issues without a minimal, runnable reproduction may be closed. This keeps the issue tracker
focused on reports that maintainers and contributors can investigate and fix.

Clear errors or gaps in the documentation are considered bugs. For documentation issues, a link to
the relevant page in the [live Remix documentation](https://remix.run/docs) and an explanation
of what is incorrect or missing is an acceptable reproduction. Requests for large-scale documentation
changes should follow the [Proposing Features](#proposing-features) process.

If you need help using Remix or troubleshooting an application, you can ask in our
[Discord](https://remix.run/discord) or start a
[Q&A Discussion](https://github.com/remix-run/remix/discussions/new?category=q-a).

## Proposing Features

Feature requests and changes to existing behavior should begin as a
[Proposal Discussion](https://github.com/remix-run/remix/discussions/new?category=proposals),
not an issue or pull request.

A useful proposal explains the problem or limitation in the current API, describes the use
cases that need to be supported, and includes sample code when it helps illustrate the desired
experience. Starting with the problem gives the community room to consider whether a new API is
the right solution, as well as discuss API design ahead of implementation.

Please do not open a pull request implementing a new feature unless a repository maintainer has
explicitly requested an implementation in the Proposal discussion. Community interest and
positive feedback are valuable, but they are not authorization to begin implementation.

## Making a Pull Request

Pull requests are welcome for existing issues. A pull request should link to the issue it closes,
for example with `Closes #1234` in its description.

Before opening a pull request:

- Keep the change focused on the linked issue or authorized proposal.
- Add or update tests for behavior changes and bug fixes.
- Update relevant documentation and examples when changing a public API.
- Add a [change file](#adding-a-change-file) when the change affects published behavior.
- Run the relevant [local validation](#local-validation).

Pull requests for new features must also link to the Proposal discussion where a repository
maintainer requested the implementation.

## Setting Up Your Environment

We develop Remix using [pnpm](https://pnpm.io) on Node 24.3 or newer.

1. Fork the repository and clone your fork.
2. Run `pnpm install` from the repository root.

## Local Validation

For the fastest local feedback loop, run:

```sh
pnpm lint
pnpm typecheck:changed
pnpm test:changed
```

The changed-workspace commands compare your work against `origin/main` and include uncommitted
changes. For broad cross-workspace changes, shared root configuration changes, or changes that
could affect the whole repository, run the full test and typecheck suites:

```sh
pnpm typecheck
pnpm test
```

You can also check formatting without modifying files:

```sh
pnpm format:check
```

### Testing

Tests run directly from source, so you do not need to build before running them.

```sh
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @remix-run/headers run test

# Run a single test file from its package directory
cd packages/headers
pnpm test src/lib/accept.test.ts
```

### Building

Packages are built using a combination of TypeScript and esbuild.

```sh
# Build all packages
pnpm build

# Build a specific package
pnpm --filter @remix-run/headers run build
```

## Making Changes

Packages live in the [`packages` directory](https://github.com/remix-run/remix/tree/main/packages).
At a minimum, each package includes:

- `CHANGELOG.md`: A log of what has changed
- `package.json`: Package metadata and dependencies
- `README.md`: Information about the package
- `src/`: The package's source code

`.changes/` directories are created on demand. A package has one only when it contains unreleased
changes.

### Adding a Change File

When making user-facing changes to a package, run the interactive change-file generator:

```sh
pnpm changes:add
```

Select the affected packages and change type, then enter a description. The generator creates a
Markdown file in the `.changes/` directory using this naming convention:

```text
[major|minor|patch].short-description.md
```

- `major` - Breaking changes for stable packages
- `minor` - New features (as well as breaking changes for `v0.x` packages)
- `patch` - Bug fixes

Do not add change files for internal-only refactors, test-only changes, or packages that are
released only because one of their dependencies changed. The release scripts automatically
include dependent packages and generate dependency-bump changelog entries.

#### Examples

- `major.change-something.md` - Breaking change for a v1.x or newer package
- `minor.add-something.md` - New feature
- `patch.fix-something.md` - Bug fix

#### Content Format

Write your change as a bullet point without the leading `-` or `*`. This content will be added to
the changelog during release.

```markdown
Add support for X feature

This is an optional longer explanation that will be indented under the main bullet point in the
changelog.
```

Change files are automatically validated in CI. You can also validate them locally:

```sh
pnpm changes:validate
```
