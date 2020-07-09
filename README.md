Welcome to Remix!

GitHub Actions suck!

## Development

```
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
yarn publish
# or
git push origin --follow-tags
```

## For Users

```
# in ~/.npmrc
//npm.pkg.github.com/:_authToken=GITHUB_PERSONAL_ACCESS_TOKEN

# in project .npmrc
@remix-run:registry=https://npm.pkg.github.com

# to install
yarn add @remix-run/react @remix-run/express
```