# Remix Development

> [!IMPORTANT]
> Remix v2 is now in maintenance mode and developed strictly on the `v2` branch.
> v2 changes should never commit to, merge to, or merge from the `main`/`dev` branches.

## Releases

- `git checkout v2`
- Update the root `CHANGELOG.md` file with the proper version number and commit
- `pnpm run version 2.x.y`
  - This will update the package.json files, commit them, and tag the commit
- `git push origin v2 --tags`
- The `remix@2.x.y` tag will kick off the Github Action to publish the release
- Once published, convert the `remix@2.x.y` tag to a Release on GitHub with the name `v2.x.y` and add a deep-link to the release heading in `CHANGELOG.md`
  - ⚠️ Make sure to uncheck the "Mark as latest" checkbox
