# `session` CHANGELOG

This is the changelog for [`session`](https://github.com/remix-run/remix/tree/main/packages/session). It follows [semantic versioning](https://semver.org/).

## v1.0.1

### Patch Changes

- Fix `createFsSessionStorage` corrupting a session file when overlapping requests save the same session. A corrupted file made every later request for that session throw. Saves now write a temporary file and rename it over the session file, so reads always see a complete session. Replaced session files keep their existing permissions. ([#12148](https://github.com/remix-run/remix/pull/12148))

  On Windows, where replacing a file can fail while another program such as a virus scanner has it open, a save retries for about a second before failing.

- `createFsSessionStorage` now starts a new session when a session file isn't valid JSON, as it does when the file is missing, instead of throwing on every request that sends that session's cookie. Visitors whose session files were corrupted by overlapping saves in earlier versions, or by a crash during a save, get a fresh session instead of an error until their cookie expires. ([#12148](https://github.com/remix-run/remix/pull/12148))

## v1.0.0

### Major Changes

- First stable release.

## v0.4.3

### Patch Changes

- Declare package modules as side-effect-free.

## v0.4.2

### Patch Changes

- Add explicit public API types to session creation defaults so generated declarations no longer depend on inferred option shapes (see #11433).

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
