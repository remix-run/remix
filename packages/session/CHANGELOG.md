# `session` CHANGELOG

This is the changelog for [`session`](https://github.com/remix-run/remix/tree/main/packages/session). It follows [semantic versioning](https://semver.org/).

## Unreleased

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

- BREAKING CHANGE: All session storage objects now require a _signed_ session cookie and work directly with `Request`/`Response` objects instead of cookie values. This should make them more secure and easier to use in a variety of environments.

  ```tsx
  // before
  import { createCookie } from '@remix-run/cookie'
  import { FileSessionStorage } from '@remix-run/session/file-storage'

  let sessionCookie = createCookie('session', { secrets: ['s3cret1'] })
  let storage = new FileSessionStorage('/tmp/sessions')
  let session = await storage.read(await sessionCookie.parse(request.headers.get('Cookie')))

  // after
  import { createCookie } from '@remix-run/cookie'
  import { createFileStorage } from '@remix-run/session/file-storage'

  let sessionCookie = createCookie('session', { secrets: ['s3cret1'] })
  let storage = createFileStorage(sessionCookie, '/tmp/sessions')
  let session = await storage.read(request)
  ```

  `@remix-run/cookie` is now a peer dependency.

- Add `session.regenerateId(deleteOldSession?: boolean)` to purge old session data when the session ID is regenerated. This is useful for preventing session fixation attacks.

## v0.1.0 (2025-11-08)

This is the initial release of `@remix-run/session`.

See the [README](https://github.com/remix-run/remix/blob/main/packages/session/README.md) for more details.
