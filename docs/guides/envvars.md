---
title: Environment Variables
---

# Environment Variables

Remix does not do anything directly with environment variables (except during local development), but there are some patterns we find useful that we'll share in this guide.

Environment Variables are values that live on the server that your application can use. You may be familiar with the ubiquitous `NODE_ENV`. Your deployment server probably automatically sets that to "production".

<docs-warning>Running `remix build` compiles using the value of `process.env.NODE_ENV` if it corresponds with a valid mode: "production", "development" or "test". If the value of `process.env.NODE_ENV` is invalid, "production" is used as a default.</docs-warning>

Here are some example environment variables you might find in the wild:

- `DATABASE_URL`: The URL for a Postgres Database
- `STRIPE_PRIVATE_KEY`: The key a checkout workflow will use on the server
- `STRIPE_PUBLIC_KEY`: The key a checkout workflow will use on the browser

If your experience with web development is primarily with the JS frameworks in the last few years, you might think of these as something for your build to use. While they can be useful for bundling code, traditionally those are "build arguments" not environment variables. Environment variables are most useful _at runtime on the server_. For example, you can change an environment variable to change the behavior of your app without rebuilding or even redeploying.

## Server Environment Variables

### Local Development

If you're using the `remix dev` server to run your project locally, it has built-in support for [dotenv](https://www.npmjs.com/package/dotenv).

First, create an `.env` file in the root of your project:

```sh
touch .env
```

<docs-error>Do not commit your <code>.env</code> file to git, the point is that it contains secrets!</docs-error>

Edit your `.env` file.

```
SOME_SECRET=super-secret
```

Then, when running `remix dev` you will be able to access those values in your loaders/actions:

```js
export async function loader() {
  console.log(process.env.SOME_SECRET);
}
```

If you're using the `@remix-run/cloudflare-pages` adapter, env variables work a little differently. You'll need to manually pass your `.env` file to `wrangler` by doing this:

```json
// package.json

{
  "scripts": {
    "dev:wrangler": "cross-env NODE_ENV=development wrangler pages dev ./public --binding $(cat .env)"
  }
}
```

<docs-info>Learn more about <a href="https://npm.im/cross-env"><code>cross-env</code></a></docs-info>

Then, in your `loader` functions, you can access environment variables directly on `context`:

```js
export const loader = async ({ context }) => {
  console.log(context.SOME_SECRET);
};
```

Note that `.env` files are only for development. You should not use them in production, so Remix doesn't load them when running `remix serve`. You'll need to follow your host's guides on adding secrets to your production server, via the links below.

### Production

Environment variables when deployed to production will be handled by your host, for example:

- [Netlify](https://docs.netlify.com/configure-builds/environment-variables/)
- [Fly.io](https://fly.io/docs/reference/secrets/)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/environment-variables)
- [Vercel](https://vercel.com/docs/environment-variables)
- [Architect](https://arc.codes/docs/en/reference/cli/env)

## Browser Environment Variables

Some folks ask if Remix can let them put environment variables into browser bundles. It's a common strategy in build-heavy frameworks. However, this approach is a problem for a few reasons:

1. It's not really an environment variable. You have to know which server you're deploying to at build time.
2. You can't change the values without a rebuild and redeploy.
3. It's easy to accidentally leak secrets into publicly accessible files!

Instead we recommend keeping all of your environment variables on the server (all the server secrets as well as the stuff your JavaScript in the browser needs) and exposing them to your browser code through `window.ENV`. Since you always have a server, you don't need this information in your bundle, your server can provide the client-side environment variables in the loaders.

1. **Return `ENV` for the client from the root loader** - Inside your loader you can access your server's environment variables. Loaders only run on the server and are never bundled into your client-side JavaScript.

   ```tsx [3-6]
   export async function loader() {
     return json({
       ENV: {
         STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
         FAUNA_DB_URL: process.env.FAUNA_DB_URL,
       },
     });
   }

   export function Root() {
     return (
       <html lang="en">
         <head>
           <Meta />
           <Links />
         </head>
         <body>
           <Outlet />
           <Scripts />
         </body>
       </html>
     );
   }
   ```

2. **Put `ENV` on window** - This is how we hand off the values from the server to the client. Make sure to put this before `<Scripts/>`

   ```tsx [10, 19-25]
   export async function loader() {
     return json({
       ENV: {
         STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
       },
     });
   }

   export function Root() {
     const data = useLoaderData();
     return (
       <html lang="en">
         <head>
           <Meta />
           <Links />
         </head>
         <body>
           <Outlet />
           <script
             dangerouslySetInnerHTML={{
               __html: `window.ENV = ${JSON.stringify(
                 data.ENV
               )}`,
             }}
           />
           <Scripts />
         </body>
       </html>
     );
   }
   ```

3. **Access the values**

   ```tsx [6-8]
   import { loadStripe } from "@stripe/stripe-js";

   export async function redirectToStripeCheckout(
     sessionId
   ) {
     const stripe = await loadStripe(
       window.ENV.STRIPE_PUBLIC_KEY
     );
     return stripe.redirectToCheckout({ sessionId });
   }
   ```
