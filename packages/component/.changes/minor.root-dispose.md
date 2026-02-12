BREAKING CHANGE: rename virtual root teardown from `remove()` to `dispose()`.

Old -> new:

- `root.remove()` -> `root.dispose()` (for both `createRoot()` and `createRangeRoot()` roots)
- `app.remove()` -> `app.dispose()` when using `run(...)`

This aligns virtual root teardown with `run(...).dispose()` for full-app cleanup.
