---
title: Environment Variables
---

# Environment Variables

Remix does not do anything directly with environment variables, but there are some patterns we find useful that we'll share in this guide.

Environment Variables are values that live on the server that your application can use. You may be familiar with the ubiquitous `NODE_ENV`. Your deployment server probably automatically sets that to "production".

<docs-warning>When you run `remix build` we will compile `process.env.NODE_ENV` into whatever the current environment value is.</docs-warning>

Here are some example environment variables you might find in the wild:

- `DATABASE_URL`: The URL for a Postgres Database
- `STRIPE_PRIVATE_KEY`: The key a checkout workflow will use on the server
- `STRIPE_PUBLIC_KEY`: The key a checkout workflow will use on the browser

If you're experience with web development is primarily with the JS frameworks in the last few years, you might think of these as something for your build to use. While they can be useful for bundling code, traditionally those are "build arguments" not environment variables. Environment variables are most useful _at runtime on the server_. For example, you can change an environment variable to change the behavior of your app without rebuilding or even redeploying.

## Server Environment Variables

Environment variables on your server will be handled by your host, for example:

- [Netlify](https://docs.netlify.com/configure-builds/environment-variables/)
- [Fly.io](https://fly.io/docs/reference/secrets/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/environment-variables)
- [Vercel](https://vercel.com/docs/environment-variables)
- [Architect](https://arc.codes/docs/en/reference/cli/env)

If your host doesn't have any conventions for environment variables during development, we recommend using [dotenv](https://www.npmjs.com/package/dotenv).

If you're using the Remix App Server, you can do this very quickly:

```sh
npm add dotenv
touch .env
```

Edit your `.env` file.

```
SOME_SECRET=super-secret
```

Then update your package.json dev script to this:

```json lines=[2] filename=package.json
{
  "dev": "node -r dotenv/config node_modules/.bin/remix dev",
  "start": "remix-serve build"
}
```

Now you can access those values in your loaders/actions:

```js
export function loader() {
  console.log(process.env.SOME_SECRET);
}
```

Note that dotenv is only for development, you should not use it in production, so don't do that with your start script, only dev. You'll need to follow your host's guides on adding secrets to your production server.

<docs-error>Do not commit your <code>.env</code> file to git, the point is that it contains secrets!</docs-error>

## Browser Environment Variables

Some folks ask if Remix can let them put environment variables into browser bundles. It's a common strategy in build-heavy frameworks. However, this approach is a problem for a few reasons:

1. It's not really an environment variable. You have to know which server you're deploying to at build time.
2. You can't change the values without a rebuild and redeploy.
3. It's easy to accidentally leak secrets into publicly accessible files!

Instead we recommend keeping all of your environment variables on the server (all the server secrets as well as the stuff your JavaScript in the browser needs) and exposing them to your browser code through `window.ENV`. Since you always have a server, you don't need this information in your bundle, your server can provide the clientside environment variables in the loaders.

1. **Return `ENV` for the client from the root loader** - Inside your loader you can access your server's environment variables. Loaders only run on the server and are never bundled into your client-side JavaScript.

   ```tsx [3-6]
   export function loader() {
     return {
       ENV: {
         STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
         FAUNA_DB_URL: process.env.FAUNA_DB_URL
       }
     };
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
   export function loader() {
     return {
       ENV: {
         STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY
       }
     };
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
               )}`
             }}
           />
           <Scripts />
         </body>
       </html>
     );
   }
   ```

3. **Access the values**

   ```tsx [6]
   import { loadStripe } from "@stripe/stripe-js";

   export async function redirectToStripeCheckout(
     sessionId
   ) {
     const stripe = await loadStripe(window.ENV.stripe);
     return stripe.redirectToCheckout({ sessionId });
   }
   ```
