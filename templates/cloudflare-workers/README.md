# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

You will be running two processes during development:

- The Wrangler (wrangler is a local environment for Cloudflare Workers)
- The Remix development server

Both are started with one command:

```sh
npm run dev
```

Open up [http://127.0.0.1:8787](http://127.0.0.1:8787) and you should be ready to go!

If you want to check the production build, you can stop the dev server and run following commands:

```sh
npm run build
npm start
```

Then refresh the same URL in your browser (no live reload for production builds).

## Deployment

If you don't already have an account, then [create a cloudflare account here](https://dash.cloudflare.com/sign-up) and after verifying your email address with Cloudflare, go to your dashboard and set up your free custom Cloudflare Workers subdomain.

Once that's done, you should be able to deploy your app:

```sh
npx wrangler publish
```

### Via GitHub Actions

If you want to deploy automatically on change to the main branch, you can create a `.github/workflows/deploy.yml` with the following contents:

```yml
name: 🕊 Deploy
on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: 🕊 Deploy
    steps:
      - name: 🛑 Cancel Previous Runs
        uses: styfle/cancel-workflow-action@0.9.1

      - name: ⬇️ Checkout repo
        uses: actions/checkout@v3

      - name: 📥 Install deps
        uses: bahmutov/npm-install@v1

      - name: 📦 Build
        run: npm run build

      - name: 🚀 Publish
        uses: cloudflare/wrangler-action@2.0.0
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          command: publish
```

You will also need to add an actions secrets called `CF_API_TOKEN` that can be retrieved from https://dash.cloudflare.com/profile/api-tokens.
