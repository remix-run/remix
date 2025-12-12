# `session` CHANGELOG

This is the changelog for [`session`](https://github.com/remix-run/remix/tree/main/packages/session). It follows [semantic versioning](https://semver.org/).

## v0.4.1 (2025-12-06)

- Always delete the original session ID when it is regenerated with the `deleteOldSession` option. Intermediate IDs are never saved to storage, so they can't be deleted.

## v0.4.0 (2025-11-25)

- Add `Session` class. The `createSession` function now returns an instance of the `Session` class.

  ```ts
  // You can now create sessions using either approach:
  import { createSession, Session } from '@remix-run/session'

  // Factory function
  let session = createSession()

  // Or use the class directly
  let session = new Session()
  ```

- BREAKING CHANGE: Rename `createFileSessionStorage` to `createFsSessionStorage` and export from `@remix-run/session/fs-storage`

  ```ts
  // before
  import { createFileSessionStorage } from '@remix-run/session/file-storage'
  let storage = createFileSessionStorage('/tmp/sessions')

  // after
  import { createFsSessionStorage } from '@remix-run/session/fs-storage'
  let storage = createFsSessionStorage('/tmp/sessions')
  ```

## v0.3.0 (2025-11-21)

- BREAKING CHANGE: Rename `createFileStorage` to `createFileSessionStorage`
- BREAKING CHANGE: Rename `createMemoryStorage` to `createMemorySessionStorage`
- BREAKING CHANGE: Rename `createCookieStorage` to `createCookieSessionStorage`

## v0.2.1 (2025-11-19)

- Fix flash messages persisting across multiple requests. Flash data is now automatically cleared after being available for one request, even if the session is not otherwise modified

## v0.2.0 (2025-11-18)

- BREAKING CHANGE: Remove `Session` class, use `createSession` instead
- BREAKING CHANGE: Remove class versions of session storage, use the factory functions instead

  ```tsx
  // before
  import { FileSessionStorage } from '@remix-run/session/file-storage'
  let storage = new FileSessionStorage(/* ... */)

  // after
  import { createFileStorage } from '@remix-run/session/file-storage'
  let storage = createFileStorage(/* ... */)
  ```

- Add `session.regenerateId(deleteOldSession?: boolean)` to purge old session data when the session ID is regenerated. This is useful for preventing session fixation attacks.

## v0.1.0 (2025-11-08)

This is the initial release of `@remix-run/session`.

See the [README](https://github.com/remix-run/remix/blob/main/packages/session/README.md) for more details.
