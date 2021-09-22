# Welcome to Remix!

- [Remix Docs](https://docs.remix.run)
- [Customer Dashboard](https://remix.run/dashboard)

## Development

From your terminal:

```sh
npm run dev:cloudflare
```

This will build your app and start a local miniflare instance, rebuilding assets on file changes.

### Using Wrangler

This project is configured out of the box to work with Wrangler commands such as:

```sh
wranger dev
```

and

```sh
wranger preview
```

## Deployment

Use wrangler to build and deploy your application to Cloudflare Workers:

```sh
wrangler publish
```
