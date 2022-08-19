# `@remix-run/netlify`

## 1.6.8

### Patch Changes

- We've added type safety for load context. `AppLoadContext` is now an an interface mapping `string` to `unknown`, allowing users to extend it via module augmentation: ([#1876](https://github.com/remix-run/remix/pull/1876))

  ```ts
  declare module "@remix-run/server-runtime" {
    interface AppLoadContext {
      // add custom properties here!
    }
  }
  ```

- Updated dependencies:
  - `@remix-run/node@1.6.8`

## 1.6.7

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.6.7`

## 1.6.6

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.6.6`

## 1.6.5

### Patch Changes

- Updated dependencies
  - `@remix-run/node@1.6.5`
