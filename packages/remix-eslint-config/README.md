# `@remix-run/eslint-config`

> [!WARNING]
> The `@remix-run/eslint-config` package is deprecated and will not be included in React Router v7. We recommend moving towards a streamlined ESLint config such as the ones included in the Remix templates. See https://github.com/remix-run/remix/blob/main/templates/remix/.eslintrc.cjs.

This package includes a shareable ESLint config for Remix projects.

If you create your app with `create-remix` no additional configuration is necessary.

## Installation

First, install this package along with ESLint in your project. **This package requires at least version 8.1 of ESLint**

```sh
npm install -D eslint @remix-run/eslint-config
```

Then create a file named `.eslintrc.js` in the root of your project:

```js filename=.eslintrc.js
module.exports = {
  extends: "@remix-run/eslint-config",
};
```

### Jest + Testing Library

This packages also ships with optional configuration options for projects that use [Jest](https://jestjs.io/) with [Testing Library](https://testing-library.com). To enable these rules, add the following to your `.eslintrc`:

```js filename=.eslintrc.js
module.exports = {
  extends: [
    "@remix-run/eslint-config",
    "@remix-run/eslint-config/jest-testing-library",
  ],
};
```

Please note that because this ruleset is optional, we do not include the core libraries as peer dependencies for this package. If you use these rules, be sure that you have the following dependencies installed in your project:

```json filename=package.json
{
  "dependencies": {
    "@testing-library/jest-dom": ">=5.16.0",
    "@testing-library/react": ">=12.0.0",
    "jest": ">=28.0.0"
  }
}
```
