---
title: Error Handling
---

# Error Handling

Remix sets a new precendent in web application error handling that you are going to love. Remix automatically catches most errors in your code, on the server or in the browser, and renders the closest [`ErrorBoundary`][error-boundary] to where the error occured. If you're familiar with React's `componentDidCatch` and `getDerivedStateFromError` class component hooks, it's just like that but with some extra handling for errors on the server.

Remix will automatically catch errors and render the nearest error boundary for errors thrown while:

- rendering in the browser
- rendering on the server
- in a loader during the initial server rendered document request
- in an action during the initial server rendered document request
- in a loader during a client side transition in the browser (Remix serializes the error and sends it over the network to the browser)
- in an action during a client side transition in the browser

## Root Error Boundary

If you used one of the starter templates you should already have an [error boundary][error-boundary] in your `root.{tsx|jsx}` file. You’ll want to edit that right away because that’s what your users will see whenever an uncaught error is thrown.

```tsx
export function ErrorBoundary({ error }) {
  console.error(error);
  return (
    <html>
      <head>
        <title>Oh no!</title>
        <Meta />
        <Links />
      </head>
      <body>
        {/* add the UI you want your users to see */}
        <Scripts />
      </body>
    </html>
  );
}
```

You'll want to make sure to still render the Scripts, Meta, and Links components because the whole document will mount and unmount when the root error boundary is rendered.

## Nested Error Boundaries

Each route in the hierarchy is a potential error boundary. If a nested route exports an error boundary, then any errors below it will be caught and rendered there. This means that the rest of the surrounding UI in the parent routes _continue to render normally_ so the user is able to click another link and not lose any client side state they might have had.

For example, consider these routes:

```sh
routes
├── sales
│   ├── invoices
│   │   └── $invoiceId.js
│   └── invoices.js
└── sales.js
```

If `$invoiceId.js` exports an `ErrorBoundary` and an error is thrown in its component, loader, or action, the rest of the app renders normally and only the invoice section of the page renders the error.

![error in a nested route where the parent route's navigation renders normall](/docs-images/error-boundary.png)

If a route doesn't have an error boundary, the error "bubbles up" to the closest error boundary, all the way to the root, so you don't have to add error boundaries to every route--only when you want to add that extra touch to your UI.

[error-boundary]: ../api/conventions#errorboundary
