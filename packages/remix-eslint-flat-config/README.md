# `@remix-run/eslint-config`

This package includes a shareable ESLint config for Remix projects.

If you create your app with `create-remix` no additional configuration is necessary.

## Installation

First, install this package along with ESLint in your project. **This package requires at least version 8.1 of ESLint**

```sh
npm install -D eslint @remix-run/eslint-config
```

Then create a file named `eslint.config.js` in the root of your project:

```js
import { coreConfig } from "@remix-run/eslint-flat-config";

export default [...coreConfig];
```

### Additional configs

This packages also ships with optional configuration objects for projects that use the following:

- [Node](https://nodejs.org/en/). To use this config, import `nodeConfig`.
- [Typescript](https://www.typescriptlang.org/). To use this config, import `typescriptConfig`.
- [Jest](https://jestjs.io/) with [Testing Library](https://testing-library.com). To use this config, import `testingLibraryConfig`.

Then, include the configs by spreading the config into your own `eslint.config.js`, like so:

```js
import {
  coreConfig,
  nodeConfig,
  typescriptConfig,
  testingLibraryConfig,
} from "@remix-run/eslint-flat-config";

export default [
  ...coreConfig,
  ...typescriptConfig,
  ...nodeConfig,
  ...testingLibraryConfig,
];
```

### Jest + Testing Library

Please note that because the testing library ruleset is optional, we do not include the core libraries as peer dependencies for this package. If you use these rules, be sure that you have the following dependencies installed in your project:

```json
{
  "@testing-library/jest-dom": ">=5.16.0",
  "@testing-library/react": ">=12.0.0",
  "jest": ">=26.0.0"
}
```
