# `@remix-run/deno`

## 1.6.8

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.6.8`

## 1.6.7

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.6.7`

## 1.6.6

### Patch Changes

- Add `index.ts` to `main` field to fix Node resolution issues when running
  `remix dev` or `remix watch`
  ([#3868](https://github.com/remix-run/remix/pull/3868))
- Updated dependencies:
  - `@remix-run/server-runtime@1.6.6`

## 1.6.5

### Patch Changes

- We enhanced the type signatures of `loader`/`action` and
  `useLoaderData`/`useActionData` to make it possible to infer the data type
  from return type of its related server function.
  ([#1254](https://github.com/remix-run/remix/pull/1254))
- Updated dependencies
  - `@remix-run/server-runtime@1.6.5`
