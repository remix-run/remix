BREAKING CHANGE: remove legacy host-element `connect` prop support in `@remix-run/component`.

Use the `ref(...)` mixin instead:

- Old: `<div connect={(node, signal) => {}} />`
- New: `<div mix={[ref((node, signal) => {})]} />`

This aligns element reference and teardown behavior with the mixin composition model.
