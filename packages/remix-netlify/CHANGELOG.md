# `@remix-run/netlify`

## 1.7.6

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.7.6`

## 1.7.5

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.7.5`

## 1.7.4

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.7.4`

## 1.7.3

### Patch Changes

- Fixed a bug that affected `.wav` and `.webm` audio file imports ([#4290](https://github.com/remix-run/remix/pull/4290))
- Updated dependencies:
  - `@remix-run/node@1.7.3`

## 1.7.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.7.2`

## 1.7.1

### Patch Changes

- Ensured that requests are properly aborted on closing of a `Response` instead of `Request` ([#3626](https://github.com/remix-run/remix/pull/3626))
- Updated dependencies:
  - `@remix-run/node@1.7.1`

## 1.7.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.7.0`

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
