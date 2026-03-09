BREAKING CHANGE: `router.map()` controllers for route maps now require a single shape: an object with an `actions` property and optional `middleware`.

Migration: Wrap existing controller objects in `actions`. Nested route maps must also use nested controllers with `{ actions, middleware? }`.
