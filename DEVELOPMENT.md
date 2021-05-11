# Remix Development

All Remix development happens here on GitHub. There are two main branches in this
repository that you should be aware of:

- `master` - This is the stable line. Code in this branch should always pass all
the tests. Hot fixes may be pushed directly to this branch without appearing in
`dev`. Docs on the website reflect this branch.
- `dev` - This is where most development happens. When hot fix commits land in
`master` they are merged into this branch. Feature branches are based on this
branch and are merged in as they are completed.

We currently use `yarn` ([version 1](https://classic.yarnpkg.com/lang/en/)) to
develop Remix. But don't get too attached to it.  We'll be migrating to npm 7
soon.

## Workflow 

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

All packages are published together except for `create-remix`, which is
versioned and published separately. To publish `create-remix`, just run the
build and publish it manually.

```bash
yarn build
npm publish build/node_modules/create-remix
```