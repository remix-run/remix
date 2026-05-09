`auth()` now installs resolved auth state as `context.auth` in addition to `context.get(Auth)`. `requireAuth()` also narrows `context.auth` to `GoodAuth<identity>` for protected handlers.
