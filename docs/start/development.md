---
title: API Development Strategy
---

# API Development Strategy

Our goals for major releases are:

- Developers can opt-in to new features and changes individually as they are released _in the current major version_ instead of everything all at once in a new major release.
- Having opted-in to features ahead-of-time, developers can upgrade to new major versions without making changes to application code.

## Unstable APIs and Future Flags

New features are introduced with `unstable_feature` flags and API prefixes.

- This allows us to iterate on the API with early adopters with breaking changes between minor releases while the API is marked unstable.
- It avoids churning the API for all users and arriving at better APIs in the stable releases.
- When an unstable feature is ready, the prefix is removed and the feature is shipped in the next minor release. The API will no longer change between minor releases.

If you are using `unstable_*` future flags or APIs, it's important to check the release notes of every minor release because the behavior or API could change. It's also important to gives us feedback so we can make it better before the final release!

## Breaking Changes and Future Flags

Breaking changes are introduced in the current major version behind a future flag. If we are on `v2` then a breaking future flag would be something like `v3_somethingDifferent`.

- Both versions work in parallel: the current `v2` behavior as well as the new `v3_somethingDifferent` behavior.
- This allows apps to update one change at a time in the current major release, instead of everything all at once in the next major release. Update on your schedule.
- If you have all `v3_*` future flags enabled, then upgrading to `v3` when it is released shouldn't require any changes to your code.
- Some breaking future flags start as `unstable_*` flags and may change between minor releases. After they become `v3_*` future flags the API should no longer change.
