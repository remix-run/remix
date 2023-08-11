---
title: API Development Strategy
description: Remix's strategy to provide a smooth upgrade experience for application developers
---

# API Development Strategy

Let's cut to the chase - major version upgrades can be a _pain_. Especially for something as foundational to your application as the framework or router it's built on. For Remix and React Router, we want to do our best to give you the smoothest upgrade experience possible.

<docs-info>This strategy is discussed in more detail in our [Future Flags][future-flags-blog-post] blog post, so give that a read if you want any more info at the end of this doc!</docs-info>

## Goals

Our goals for major Remix and React Router releases are:

- Developers can opt-into SemVer-major features individually _as they are released_ instead of having to wait to adopt them all at once when a new major version hits NPM
- Having opted into features ahead-of-time, developers can upgrade to new major versions in a single short-lived branch/commit (hours, not weeks)

## Implementation

We plan to do this via what we're calling **Future Flags** in the `remix.config.js` file. Think of these as **feature flags for future features**. As we implement new features, we always try to do them in a backwards-compatible way. But when a breaking change is warranted, we don't table that feature up for an _eventual_ release in the next major version. Instead, we add a **Future Flag** and implement the new feature alongside the current behavior in a minor release. This allows users to start using the feature, providing feedback, and reporting bugs _immediately_.

That way, not only can you adopt features incrementally (and eagerly without a major version bump), we can also work out any kinks incrementally _before_ the next major release. Eventually we also then add deprecation warnings to the current major version to nudge users to the new behavior. Then in next major release we remove the old behavior, remove the deprecations, and remove the flag - thus making the flagged behavior the new default. If at the time the next major version is released, an application has opted into _all_ future flags and updated their code - then they should just be able to update their Remix dependencies to the latest version and delete the future flags from their `remix.config.js` and be running in a matter of minutes.

## Unstable vs. Versioned Flags

Future flags come in 2 forms:

**`future.unstable_feature`**

`unstable_` flags allow us to iterate on the API with early adopters as if we're in `v0.x.x` versions, but for a specific feature. This avoids churning the API for all users and arriving at better APIs in the final release. This _does not mean_ that we think the feature is bug-ridden! We _absolutely_ want early adopters to start using these features so we can iterate on (and/or gain confidence in) the API.

**`future.vX_feature`**

`vX_` (where `X` is the next major version) indicates a breaking change from current behavior and implies (1) that the API is considered stable and will not under any more breaking changes and (2) that the API will become the default behavior in the next major release. A `vX_` flag _does not_ mean the feature is bug-free - no software is! Our recommendation is to upgrade to versioned flags as you have the time, as it will make your next major upgrade _much_ smoother.

### Example New Feature Flow

The decision flow for a new feature looks something like this:

![Flowchart of the decision process for how to introduce a new feature][feature-flowchart]

The lifecycle is thus either:

- Non-Breaking + Stable API Feature -> Lands directly in current major
- Non-Breaking + Unstable API -> `future.unstable_` flag in current major -> Lands in current major
- Breaking + Stable API Feature -> `future.vX_` flag in current major -> Default behavior in next major
- Breaking + Unstable API -> `future.unstable_` flag in current major -> `future.vX_` flag in current major -> Default behavior in next major

[future-flags-blog-post]: https://remix.run/blog/future-flags
[feature-flowchart]: /docs-images/feature-flowchart.png
