# `cookie` CHANGELOG

This is the changelog for [`cookie`](https://github.com/remix-run/remix/tree/main/packages/cookie). It follows [semantic versioning](https://semver.org/).

## v0.6.0

### Minor Changes

- BREAKING CHANGE: Custom `encode` and `decode` functions now own the cookie value representation directly. Previously, custom `encode` output was still wrapped in Remix's default base64 encoding and custom `decode` received a value after that base64 wrapper was removed. Now custom `encode` output is signed and serialized as-is, and custom `decode` receives the unsigned raw cookie value. The default encoder and decoder still use the existing base64-safe representation when no custom functions are provided.

- BREAKING CHANGE: `Cookie.httpOnly` now returns `boolean | undefined` instead of defaulting to `false`. This lets consumers distinguish an omitted `httpOnly` option from an explicit `httpOnly: false` setting.

## v0.5.4

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`headers@0.21.1`](https://github.com/remix-run/remix/releases/tag/headers@0.21.1)

## v0.5.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`headers@0.21.0`](https://github.com/remix-run/remix/releases/tag/headers@0.21.0)

## v0.5.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`headers@0.20.0`](https://github.com/remix-run/remix/releases/tag/headers@0.20.0)

## v0.5.1

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v0.5.0 (2025-11-25)

- Add `Cookie` class. The `createCookie` function now returns an instance of the `Cookie` class.

  ```ts
  // You can now create cookies using either approach:
  import { createCookie, Cookie } from '@remix-run/cookie'

  // Factory function
  let cookie = createCookie('session')

  // Or use the class directly
  let cookie = new Cookie('session')
  ```

## v0.4.1 (2025-11-19)

- Force `secure` to be `true` when `partitioned` is `true`

## v0.4.0 (2025-11-18)

- BREAKING CHANGE: Remove `Cookie` class, use `createCookie` instead

  ```tsx
  // before
  import { Cookie } from '@remix-run/cookie'
  let cookie = new Cookie('session')

  // after
  import { createCookie } from '@remix-run/cookie'
  let cookie = createCookie('session')
  ```

- Add `domain`, `expires`, `httpOnly`, `maxAge`, `partitioned`, `path`, `sameSite`, and `secure` properties to `Cookie` objects

## v0.3.0 (2025-11-08)

- BREAKING CHANGE: Rename `cookie.isSigned` to `cookie.signed`
- Add `createCookie` function to create a new `Cookie` object
- `CookieOptions` now extends `CookieProperties` so all cookie properties may be set in the `Cookie` constructor

## v0.2.0 (2025-11-04)

- Update `@remix-run/headers` peer dep to v0.15.0

## v0.1.0 (2025-11-04)

This is the initial release of `@remix-run/cookie`.

See the [README](https://github.com/remix-run/remix/blob/main/packages/cookie/README.md) for more details.
