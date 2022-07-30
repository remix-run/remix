# `remix`

## 1.6.7

### Patch Changes

- Remove logical nullish assignment, which is incompatible with Node v14. ([#3880](https://github.com/remix-run/remix/pull/3880))
- Fix inferred types for `useLoaderData` and `useActionData` to preserve `null`s. Previously, `null` types were being replaced by `never` due to usage of `NonNullable` in `UndefinedOptionals`. Properties that aren't unions with `undefined` are now kept as-is, while properties that _do_ include `undefined` are still made optional, but _only_ remove `undefined` from the property type whereas `NonNullable` also removed `null` types. ([#3879](https://github.com/remix-run/remix/pull/3879))

See the `CHANGELOG.md` in individual Remix packages for all changes.
