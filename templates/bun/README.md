# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

Start the Remix development server and the Bun application server by running:

```sh
bun run dev
```

This starts your app in development mode, performing HMR both on the server and in the browser when Remix rebuilds assets so you don't need a process manager restarting the express server.

## Deployment

First, build your app for production:

```sh
bun run build
```

Then run the app in production mode:

```sh
bun run start
```

Now you'll need to pick a host to deploy it to.
