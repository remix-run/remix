# Welcome to Remix!

This is a very basic example of a Remix app, using the Remix App Server and Yarn PnP.

- [Remix Docs](https://remix.run/docs)
- [Yarn Plug'n'Play](https://next.yarnpkg.com/features/pnp)

## Development

From your terminal

```sh
yarn install
yarn dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

First, build your app for production:

```sh
yarn build
```

Then run the app in production mode:

```sh
yarn start
```

## Notes for Using Yarn PnP

- You'll need to use Yarn ≥ v3.2.0. Older versions don't work because of [an issue with Yarn](https://github.com/yarnpkg/berry/issues/3687).
- For editor support of PnP, refer to [Editor SDKs](https://yarnpkg.com/getting-started/editor-sdks).
- When using TypeScript, consider installing the [Yarn TypeScript plugin](https://github.com/yarnpkg/berry/tree/master/packages/plugin-typescript).
- For the `~/*` alias to work for imports relative to `app/*`, you have to add this to your `package.json`:
  ```json
  "dependencies": {
    /* ... */
    "~": "link:app/"
  }
  ```
  You can then also remove the `~` alias from your `tsconfig.json`.
- For only installing non-dev dependencies in production, you can use [`yarn workspaces focus`](https://yarnpkg.com/cli/workspaces/focus) after removing the `.yarn/cache` directory:
  ```sh
  yarn install
  yarn build
  rm -r .yarn/cache
  yarn workspaces focus --production
  yarn start
  ```
  Or check out [plugin-installs](https://gitlab.com/Larry1123/yarn-contrib/-/blob/master/packages/plugin-production-install/README.md) by [Larry1123](https://gitlab.com/Larry1123).
