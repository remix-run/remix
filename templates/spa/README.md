# templates/spa

This template leverages [Remix SPA Mode](https://remix.run/docs/en/main/future/spa-mode) to build your app as a Single-Page Application using [Client Data](https://remix.run/docs/en/main/guides/client-data) for all of you data loads and mutations.

⚠️ This is built on top of the Remix Vite template. Remix support for Vite is currently unstable and not recommended for production.

📖 See the [Remix Vite docs][remix-vite-docs] for details on supported features.

## Setup

```shellscript
npx create-remix@latest --template remix-run/remix/templates/spa
```

## Development

You can develop your SPA app just like you would a normal Remix app, via:

```shellscript
npm run dev
```

## Production

When you are ready yo build a production version of your app, `npm run build` will generate your assets and an `index.html` for the SPA.

```shellscript
npm run build
```

You can serve this from any server of your choosing, for a simple example, you could use [http-server](https://www.npmjs.com/package/http-server):

```shellscript
npx http-server build/client/
```

[remix-vite-docs]: https://remix.run/docs/en/main/future/vite
