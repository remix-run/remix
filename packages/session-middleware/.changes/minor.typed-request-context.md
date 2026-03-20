`session()` now contributes `Session` to `fetch-router`'s typed request context, so apps deriving context from middleware can read `context.get(Session)` without manual type assertions.
