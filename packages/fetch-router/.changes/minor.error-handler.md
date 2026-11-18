Add an `errorHandler` option to `createRouter()` that responds when a route action, action middleware, or the default handler throws. Like `defaultHandler`, it runs inside the router middleware and receives the same typed context as an action, so it can render an app-owned error page with values such as `context.render`. Its response passes back through the router middleware like any other response.

```tsx
let router = createRouter({
  middleware: [render()],
  errorHandler(error, { render }) {
    console.error(error)
    return render(<ErrorPage />, { status: 500 })
  },
})
```

Errors thrown by router middleware, errors from aborted requests, and errors thrown by the error handler itself still reject `router.fetch()`. Without an `errorHandler`, errors reject `router.fetch()` as before.
