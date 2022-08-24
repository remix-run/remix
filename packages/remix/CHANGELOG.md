# `remix`

## 2.0.0-pre.0

### Minor Changes

- We've added a new type: `SerializeFrom`. This is used to infer the ([#4013](https://github.com/remix-run/remix/pull/4013))
  JSON-serialized return type of loaders and actions.
- `MetaFunction` type can now infer `data` and `parentsData` types from route loaders ([#4022](https://github.com/remix-run/remix/pull/4022))

### Patch Changes

- Removed our compiler's React shim in favor of esbuild's new automatic JSX transform ([#3860](https://github.com/remix-run/remix/pull/3860))

See the `CHANGELOG.md` in individual Remix packages for all changes.
