Rendering fixes and improvements in `remix/component`:

- List updates no longer put DOM in the wrong place, remove siblings, or throw `NotFoundError` when a keyed `<Fragment>` gains children, a component switches from `null` to DOM while siblings move, or a trailing `<Fragment>` loses its children. New keyed children are inserted once at their final position, so custom elements no longer run `connectedCallback` twice.
- Mixins that listen for `beforeUpdate` or `commit`, such as `animateLayout()` from `@remix-run/ui`, now scale linearly with the number of mounted elements instead of quadratically.
- The browser runtime loads fewer modules: pages that hydrate with `run()` load 23 component modules instead of 35, and `updateUrl()` and `spaResponse` load only in apps that import them.
- `clientEntry()` no longer fails with "Type instantiation is excessively deep and possibly infinite" for props that mix `SerializableObject` with other serializable values, such as a `FormSubmission`.

See the [`@remix-run/component` changelog](https://github.com/remix-run/remix/blob/main/packages/component/CHANGELOG.md) for details.
