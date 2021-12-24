# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

You will be utlizing Wrangler for local development to emulate the Cloudflare runtime. This is already wired up in your package.json as the `dev` script:

```sh
# start the remix dev server and wrangler
$ npm run dev
```

Open up [http://127.0.0.1:8788](http://127.0.0.1:8788) and you should be ready to go!

## Deployment

Cloudflare Pages are currently only deployable through their Git provider integrations.

If you don't already have an account, then [create a Cloudflare account here](https://dash.cloudflare.com/sign-up/pages) and after verifying your email address with Cloudflare, go to your dashboard and follow the [Cloudflare Pages deployment guide](https://developers.cloudflare.com/pages/framework-guides/deploy-anything).

Configure the "Build command" should be set to `npm run build`, and the "Build output directory" should be set to `public`.

## To Prevent the Unsupported ESM URL Scheme Error

If your build script uses `postcss` to build the CSS files before running `remix build` like `"cross-env NODE_ENV=production npm run build:css && remix build"`, you will find an error at build time, because Cloudflare Pages uses Node version 12 as default.

So, we need to tell Cloudflare pages to use Node version 14 at build time.

Under the Cloudflare Pages Project Settings, set the Production Environment "NODE_VERSION" to 14.

Variable Name | Value |
--- | ---
NODE_VERSION  | 14 |

