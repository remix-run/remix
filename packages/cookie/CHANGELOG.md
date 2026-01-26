# `cookie` CHANGELOG

This is the changelog for [`cookie`](https://github.com/remix-run/remix/tree/main/packages/cookie). It follows [semantic versioning](https://semver.org/).

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
