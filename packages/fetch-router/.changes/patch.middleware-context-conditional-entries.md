`RouterContext` and `MiddlewareContext` no longer lose every middleware type when a middleware array contains a conditional entry, such as a dev-only logger. Previously, a spread like `...(isDev ? [logger()] : [])` made the whole context fall back to the base `RequestContext`, so values like `context.formData` were missing in controllers with no error at the router. Middleware before and after the conditional entry is now applied in order, and the conditional middleware itself is left off the context because it may not run (see #11997).

```ts
let router = createRouter({
  middleware: [
    ...(process.env.NODE_ENV === 'development' ? [logger()] : []),
    formData(),
    render({ assets }),
  ],
})

// Now includes `formData` and `render`
type AppContext = RouterContext<typeof router>
```
