BREAKING CHANGE: Session middleware no longer reads/writes `context.session`.

Session state is now stored on request context using the `Session` class itself as the context key and accessed with `context.get(Session)`.
