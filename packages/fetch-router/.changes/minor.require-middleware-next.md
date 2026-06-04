BREAKING CHANGE: Middleware must now explicitly continue the request chain by calling `next()` or return a `Response`. The router no longer calls `next()` automatically when middleware returns `undefined`; instead, it throws an error to catch missing continuation bugs early.

Middleware that only mutates context should return the downstream response:

```ts
// Before
function loadUser(): Middleware {
  return (context) => {
    context.set(CurrentUser, user)
  }
}

// After
function loadUser(): Middleware {
  return (context, next) => {
    context.set(CurrentUser, user)
    return next()
  }
}
```

Middleware that needs to inspect or modify the downstream response should `await next()` and return a `Response`:

```ts
function logger(): Middleware {
  return async (context, next) => {
    let response = await next()
    console.log(context.request.url, response.status)
    return response
  }
}
```
