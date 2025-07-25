# Remix Development

> [IMPORTANT]!
> Remix v2 is now in maintenance mode and developed strictly on the `v2` branch.
> v2 changes should never commit to, merge to, or merge from the `main`/`dev` branches.

## Releases

v2 releases are managed from a `release-v2` branch created from the `v2` branch. Changesets will do most of the heavy lifting for our releases. When changes are made to the codebase, an accompanying changeset file should be included to document the change. Those files will dictate how Changesets will version our packages and what shows up in the changelogs.

### Starting a new pre-release

- Check out the `v2` branch and pull latest from GitHub
- If needed, bump the dependencies to the correct React Router release
  - `./scripts/bump-router-versions.sh [pre|latest]`
- Create a new `release-v2` branch
  - `git checkout -b release-v2`
- Enter Changesets pre-release mode using the `pre` tag
  - `pnpm changeset pre enter pre`
- Commit the change and push the `release-v2` branch to GitHub
  - `git commit -am "Enter prerelease mode"`
  - `git push --set-upstream origin release-v2`
- Wait for the changesets release workflow to finish - the Changesets action in the workflow will open a PR that will increment all versions and generate the changelogs
- Merge the PR into the `release-v2` branch and the changesets action will publish the prerelease to `npm`
- At this point, you can begin crafting the release notes for the eventual stable release in the root `CHANGELOG.md` file in the repo
  - Copy the template for a new release and update the version numbers and links accordingly
  - Copy the relevant changelog entries from all packages into the release notes and adjust accordingly
    - `find packages -name 'CHANGELOG.md' -mindepth 2 -maxdepth 2 -exec code {} \;`
  - Commit these changes and push directly to the `release-v2` branch - they will not trigger a new prerelease since they do not include a changeset

### Iterating a pre-release

You may need to make changes to a pre-release prior to publishing a final stable release. To do so:

- Branch from `release-v2` and make whatever changes you need
- Create a new changeset: `pnpm changeset`
  - **IMPORTANT:** This is required even if you ultimately don't want to include these changes in the logs
  - Changelogs can be edited prior to publishing, but the Changeset version script needs to see new changesets in order to create a new prerelease version
- Commit the changesets to your branch
- PR and merge it to the `release-v2` branch
- Wait for the release workflow to finish and the Changesets action to open its PR that will increment all versions
- Review the PR, make any adjustments necessary, and merge it into the `release-v2` branch
- Once the PR is merged, the release workflow will publish the updated packages to npm
- Make sure you copy over the new changeset contents into stable release notes in the root `CHANGELOG.md` file in the repo

### Publishing the stable release

- Exit Changesets pre-release mode in the `release-v2` branch:
  - `pnpm changeset pre exit`
- Commit the edited `pre.json` file along with any unpublished changesets, and push the `release-v2` branch to GitHub
  - `git commit -am "Exit prerelease mode"`
  - `git push origin release-v2`
- Wait for the release workflow to finish - the Changesets action in the workflow will open a PR that will increment all versions and generate the changelogs for the stable release
- Review the updated `CHANGELOG` files and make any adjustments necessary
  - `find packages -name 'CHANGELOG.md' -mindepth 2 -maxdepth 2 -exec code {} \;`
  - Our automated release process should have removed prerelease entries
- Finalize the release notes
  - This should already be in pretty good shape in the root `CHANGELOG.md` file in the repo
  - Do a quick double check that all iterated prerelease changesets got copied over
- Merge the PR into the `release-v2` branch
- Once the PR is merged, the release workflow will publish the updated packages to npm
- Once the release is published:
  - Pull the latest `release-2` branch containing the PR you just merged
  - Merge the `release-v2` branch into `v2` **using a non-fast-forward merge** and push it up to GitHub
    - `git checkout v2; git merge --no-ff release-v2`
  - Convert the `remix@1.x.y` tag to a Release on GitHub with the name `v2.x.y` and add a deep-link to the release heading in `CHANGELOG.md`
    - ⚠️ Make sure to uncheck the "Mark as latest" checkbox

### Experimental releases

Experimental releases use a [manually-triggered Github Actions workflow](./.github/workflows/release-experimental.yml) and can be built from any existing branch. to build and publish an experimental release:

- Commit your changes to a branch
- Push the branch to github
- Go to the Github Actions UI for the [release-experimental.yml workflow](https://github.com/remix-run/remix/actions/workflows/release-experimental-dispatch.yml)
- Click the `Run workflow` dropdown
- Leave the `Use workflow from` dropdown as `main`
- Enter your feature branch in the `branch` input
- Click the `Run workflow` button
