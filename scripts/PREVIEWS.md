# Preview releases

Preview builds publish package tarballs to a separate public GitHub repository. The destination defaults to `remix-run/previews`; set the `REMIX_PREVIEWS_REPOSITORY` Actions variable in `remix-run/remix` to use another `owner/repo`, and update the README discovery link accordingly.

Initialize the destination with a README and disable release immutability. Add a fine-grained PAT scoped to that repository with Contents read/write as the `REMIX_PREVIEWS_PAT` Actions secret in `remix-run/remix`. The normal `GITHUB_TOKEN` continues to handle source PR queries and comments. The destination needs no workflow or source mirror.

The workflow checks out its tooling separately from the selected source commit, so existing PRs and experimental refs can predate these scripts. It builds without the PAT, then uploads the resulting tarballs in a separate job. Each source SHA gets its own prerelease containing every public package and `preview.json`. Tags point at the destination's default branch; the manifest and release notes identify the actual source commit. Internal dependencies use URLs for tarballs from the same release.

Publication creates a draft, uploads and verifies every asset, then publishes it. Retrying an incomplete draft replaces its draft assets as a set. Retrying a completed release reuses its existing bytes and original publication timestamp. Releases are not marked latest. Publishing and cleanup share a queue per preview channel, without canceling successive SHA builds.

Main releases older than seven days are removed after publication and by a daily scheduled job. The newest successful main build is always kept. Every PR SHA is kept until merge, when all that PR's releases and tags are removed. Closed, unmerged PRs retain their previews. A publication that starts after merge skips uploading; publication also checks merge status again on exit. Experimental releases are retained until explicitly removed.

## Local commands

Run these from a clean checkout of the source commit. Building temporarily rewrites package manifests and restores their original contents even if packing fails. The output directory must be empty.

```sh
pnpm preview build main
pnpm preview build pr-123
pnpm preview build experimental-my-feature
```

The default output is `.preview/`; use `--output <directory>` to select another directory. To print the build plan without building, changing files, or contacting GitHub:

```sh
pnpm preview build main --dry-run
```

With `REMIX_PREVIEWS_PAT` exported in the environment, publish or prune builds:

```sh
pnpm preview publish
pnpm preview cleanup main --dry-run
pnpm preview cleanup main
pnpm preview cleanup pr-123
```

`publish --dry-run` validates local artifacts and prints the intended release without contacting GitHub. Cleanup dry runs query existing releases but do not delete anything. PR cleanup checks that the source PR is merged before deleting its builds. Source PR queries use `GITHUB_TOKEN` when present, otherwise the GitHub CLI's existing authentication. All GitHub operations require `gh`.

The Preview Build workflow can also be dispatched with `baseBranch` and `previewName` to publish `experimental-<previewName>-<sha>` releases. Names may contain letters, numbers, dots, underscores, and hyphens, and must start with a letter or number.

Existing preview branches are not migrated or removed automatically: their packaged manifests contain the old download URLs. New builds use release assets. The other checkout/history optimizations from the tarball preview change remain in place.
