BREAKING CHANGE: remove legacy host-element `on` prop support in `@remix-run/component`.

Use the `on()` mixin instead:

- Old: `<button on={{ click() {} }} />`
- New: `<button mix={[on('click', () => {})]} />`

This change removes built-in host `on` handling from runtime, typing, and host-prop composition. Component-level `handle.on(...)` remains supported.
