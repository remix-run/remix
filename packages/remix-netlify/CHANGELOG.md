# `@remix-run/netlify`

## 1.19.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.19.3`

## 1.19.2

### Patch Changes

- Show deprecation warning on `@remix-run/netlify` usage, which is deprecated in favor of `@netlify/remix-adapter` ([#6937](https://github.com/remix-run/remix/pull/6937))
- Updated dependencies:
  - `@remix-run/node@1.19.2`

## 1.19.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.19.1`

## 1.19.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.19.0`

## 1.18.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.18.1`

## 1.18.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.18.0`

## 1.17.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.17.1`

## 1.17.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.17.0`

## 1.16.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.16.1`

## 1.16.0

### Patch Changes

- feat: support async `getLoadContext` in all adapters ([#6170](https://github.com/remix-run/remix/pull/6170))
- Updated dependencies:
  - `@remix-run/node@1.16.0`

## 1.15.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.15.0`

## 1.14.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.14.3`

## 1.14.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.14.2`

## 1.14.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.14.1`

## 1.14.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.14.0`

## 1.13.0

### Patch Changes

- Fix fetch `Request` creation for incoming URLs with double slashes ([#5336](https://github.com/remix-run/remix/pull/5336))
- Updated dependencies:
  - `@remix-run/node@1.13.0`

## 1.12.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.12.0`

## 1.11.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.11.1`

## 1.11.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.11.0`

## 1.10.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.10.1`

## 1.10.0

### Patch Changes

- Improve performance of `isBinaryType` ([#4761](https://github.com/remix-run/remix/pull/4761))
- Updated dependencies:
  - `@remix-run/node@1.10.0`

## 1.9.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.9.0`

## 1.8.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.8.2`

## 1.8.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.8.1`

## 1.8.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/node@1.8.0`

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
