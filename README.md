# Welcome to Remix development!

Remix is a framework for shipping better websites.

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

# cut a prerelease
# make a branch to hold your commits
git checkout -b release/0.8.0

# add the pre release tag
yarn run version prerelease pre

# push as usual
git push origin release/0.8.0 --follow-tags
```

## Roadmap

- dev server
  - changes to loaders appear when you reload the page
  - changes to components immediately show up
  - changes to styles immediately show up
  - dev server proxy function for various platforms
