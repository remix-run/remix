# Maintaining Remix

This document covers repository operations for Remix maintainers. For the community contribution
workflow and local development instructions, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Releases

Releases are automated by the
[`release-pr` workflow](https://github.com/remix-run/remix/blob/main/.github/workflows/release-pr.yaml)
and the
[`publish` workflow](https://github.com/remix-run/remix/blob/main/.github/workflows/publish.yaml).

1. Changes are pushed to `main` with change files in `packages/<package>/.changes/`
2. A Release pull request is automatically opened, or updated if one exists
   - It contains updated `package.json` versions, updated `CHANGELOG.md` files, and deleted change files
   - Do not edit this pull request manually
   - Modify the change files or release scripts on `main` to trigger an update
3. Merging the Release pull request triggers the publish workflow
   - Since the change files have been deleted, it publishes all unpublished packages to npm
   - It then creates Git tags and GitHub releases for the packages that were published

### Manual Versioning

The Release pull request automates the `pnpm changes:version` command. If needed, run the command
manually to update package versions and changelogs, delete change files, and commit the result:

```sh
pnpm changes:version
```

Use `--no-commit` to leave the changes staged for review. The command also prints the commit
message it would have used:

```sh
pnpm changes:version --no-commit
```

Tags and GitHub releases are created automatically by the publish workflow after a successful npm
publish.

### Prerelease Mode

Packages can opt into prerelease mode by creating an optional `.changes/config.json` file:

```json
{
  "prereleaseChannel": "alpha"
}
```

The `prereleaseChannel` determines the version suffix, such as `alpha`, `beta`, or `rc`.
Prereleases are always published to npm with the `next` tag. This is currently used for `remix`.

#### Bumping Prerelease Versions

While in prerelease mode, add change files normally. The prerelease counter increments, for
example from `3.0.0-alpha.1` to `3.0.0-alpha.2`. Changelog entries are grouped under
"Pre-release Changes", and the bump type is otherwise ignored.

#### Transitioning Between Prerelease Channels

To transition between channels, such as `alpha` to `beta`:

1. Update `prereleaseChannel` in `.changes/config.json` to the new channel.
2. Add a change file describing the transition.

The version resets to the new channel, for example from `3.0.0-alpha.7` to `3.0.0-beta.0`. The
bump type is used only for changelog categorization; by convention, use `patch`.

#### Graduating a Prerelease Package to Stable

To release the stable version:

1. Remove `prereleaseChannel` from `.changes/config.json`, or delete the file.
2. Add a change file describing the stable release.

The prerelease suffix is removed, for example from `3.0.0-rc.7` to `3.0.0`. The bump type is used
only for changelog categorization; by convention, use `major` for a major release announcement.

## Preview Builds

The `preview/main` branch provides installable builds of `main` without publishing releases to npm.
The
[`preview` workflow](https://github.com/remix-run/remix/blob/main/.github/workflows/preview.yml)
runs [`setup-installable-branch.ts`](./scripts/setup-installable-branch.ts) after every commit to
`main`. The script builds the repository and commits the build output and required `package.json`
changes to `preview/main`.

The `preview/main` build can be installed directly with pnpm 9 or newer:

```sh
pnpm install "remix-run/remix#preview/main&path:packages/remix"

# Or install a single package
pnpm install "remix-run/remix#preview/main&path:packages/fetch-router"
```
