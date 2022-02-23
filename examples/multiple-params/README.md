# Multiple Params Example

This shows how you can structure your routes to support multiple parameters.

Here's the file structure for this project:

```
app
├── db.ts
├── entry.client.tsx
├── entry.server.tsx
├── root.tsx
└── routes
    ├── clients
    │   ├── $clientId
    │   │   ├── index.tsx
    │   │   ├── invoices
    │   │   │   ├── $invoiceId.tsx
    │   │   │   └── index.tsx
    │   │   └── invoices.tsx
    │   ├── $clientId.tsx
    │   └── index.tsx
    ├── clients.tsx
    └── index.tsx
```

Here's the output of `remix routes` for this project:

```jsx
<Routes>
  <Route file="root.tsx">
    <Route path="clients" file="routes/clients.tsx">
      <Route path=":clientId" file="routes/clients/$clientId.tsx">
        <Route path="invoices" file="routes/clients/$clientId/invoices.tsx">
          <Route
            path=":invoiceId"
            file="routes/clients/$clientId/invoices/$invoiceId.tsx"
          />
          <Route index file="routes/clients/$clientId/invoices/index.tsx" />
        </Route>
        <Route index file="routes/clients/$clientId/index.tsx" />
      </Route>
      <Route index file="routes/clients/index.tsx" />
    </Route>
    <Route index file="routes/index.tsx" />
  </Route>
</Routes>
```

- [Remix Docs](https://remix.run/docs)

## Development

From your terminal:

```sh
npm install
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/multiple-params)
