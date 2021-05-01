We currently use `yarn` ([version 1](https://classic.yarnpkg.com/lang/en/)) to
develop Remix. But don't get too attached to it.  We'll be migrating to npm 7
soon.

## Development

```bash
# install everything
yarn install

# run the build
yarn build

# run the tests
yarn test
# run the tests for a specific package
yarn test react
# run the tests in watch mode
yarn test react --watch

# cut a release
yarn run version major|minor|patch|prerelease [prereleaseId]
yarn run publish
# or, to automatically publish from GitHub Actions
git push origin --follow-tags
```
