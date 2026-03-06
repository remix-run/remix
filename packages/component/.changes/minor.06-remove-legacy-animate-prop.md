BREAKING CHANGE: remove legacy host-element `animate` prop runtime support in `@remix-run/component`.

Use animation mixins instead:

- Old: `<div animate={{ enter: true, exit: true, layout: true }} />`
- New: `<div mix={[animateEntrance(), animateExit(), animateLayout()]} />`

This aligns animation behavior with the new mixin composition model.
