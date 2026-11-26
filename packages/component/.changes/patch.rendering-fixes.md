Rendering and hydration fixes:

- A mixin can read its own `handle.signal` in `beforeUpdate` and `commit` listeners when its component schedules an update.
- A client entry whose loader throws synchronously can load again on a later render instead of staying failed.
- A keyed element that returns during its exit animation reuses its existing mixins without running setup again and picks up changes to its `innerHTML`.
- Range roots created with `createRangeRoot()` keep hydration inside their boundaries when a server-rendered tag differs from the client tag or text spans several DOM nodes. Content outside the range is no longer changed or removed when the root is disposed.
