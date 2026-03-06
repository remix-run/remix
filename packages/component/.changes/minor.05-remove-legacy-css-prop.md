BREAKING CHANGE: remove legacy host-element `css` prop runtime support in `@remix-run/component`.

Use the `css(...)` mixin instead:

- Old: `<div css={{ color: 'red' }} />`
- New: `<div mix={[css({ color: 'red' })]} />`

This aligns styling behavior with the new mixin composition model.
