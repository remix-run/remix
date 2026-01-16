# Branching and Releasing in Remix 3

Beginning in Remix 3 the `remix` package is an umbrella package for everything in Remix. This includes a number of "sub-packages" that are all published under the `@remix-run/*` scope. The `remix` package re-exports everything from all sub-packages as a transparent pass-thru. This means users only have to install `remix` to get everything we publish, and they can import everything from some `remix/*` export.

We anticipate the majority of Remix development will happen directly on the `main` branch. `main` should always be publishable, so we can e.g. publish nightlies from `main`. We are also free to publish minor/patch changes from `main` at any time.

## Breaking Changes

When it comes to breaking changes, we have 2 goals:

- Be slow and deliberate about cutting major `remix` releases so we don't stress people out by releasing majors too often
- Release breaking changes in sub-packages as soon as they are ready so people can play with them

Major `remix` releases will happen on a predetermined schedule so that users may plan upgrades into their development lifecycle.

Breaking changes will accumulate on a `future` branch. The `future` branch is a preview of what the next major version of Remix will look like. If someone wants to play with the latest stuff, they can build directly from `future`. We don't make any guarantees about the [stability][^stability] of `future`, which is why users must build from source.

We will publish new majors of sub-packages as soon as they are ready from the `future` branch. When it's time to cut the next major `remix` release, we will merge `future` into `main`. Of course, this means that `main` should be merged into `future` periodically to make this easier.

[^stability]: By "stable" we mean "won't break between releases". Both `main` and `future` should always pass all tests and be usable, but on `main` we have versions and stability guarantees between them. On `future`, we don't.
