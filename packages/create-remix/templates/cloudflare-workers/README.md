# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

You will be running two processes during development:

- The Miniflare server (miniflare is a local environment for Cloudflare Workers)
- The Remix development server

```sh
# in one tab, start the remix dev server
$ npm run dev

# in another, start the miniflare server
$ npm start
```

Open up [http://127.0.0.1:8787](http://127.0.0.1:8787) and you should be ready to go!

If you'd rather run everything in a single tab, you can look at [concurrently](https://npm.im/concurrently) or similar tools to run both processes in one tab.

## Deployment

Use wrangler to build and deploy your application to Cloudflare Workers:

```sh
npm run deploy
```
