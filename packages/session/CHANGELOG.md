# `session` CHANGELOG

This is the changelog for [`session`](https://github.com/remix-run/remix/tree/main/packages/session). It follows [semantic versioning](https://semver.org/).

## Unreleased

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
