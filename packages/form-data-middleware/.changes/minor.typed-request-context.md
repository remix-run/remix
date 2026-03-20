`formData()` now contributes `FormData` to `fetch-router`'s typed request context, so apps deriving context from middleware can read `context.get(FormData)` without manual type assertions.
