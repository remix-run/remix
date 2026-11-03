`RouterContext` and `MiddlewareContext` no longer drop every middleware value when the middleware array contains a conditional entry like `...(isDev ? [logger()] : [])`. Middleware before and after the conditional entry now types the context; the conditional middleware's own values are left out because it may not run.

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
