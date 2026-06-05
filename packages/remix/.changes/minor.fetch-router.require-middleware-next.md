BREAKING CHANGE: Middleware consumed through `remix/router` and `remix/fetch-router` must now explicitly continue the request chain by calling `next()` or return a `Response`. Middleware that returned `undefined` without calling `next()` now throws at runtime instead of implicitly continuing.

Update context-loading middleware to return the downstream response:

```ts
function loadUser(): Middleware {
  return (context, next) => {
    context.set(CurrentUser, user)
    return next()
  }
}
```
