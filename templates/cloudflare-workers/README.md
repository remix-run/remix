# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

You will be running two processes during development:

- The Miniflare server (miniflare is a local environment for Cloudflare Workers)
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
npm run deploy
```

## Using [ES Module workers](https://blog.cloudflare.com/workers-javascript-modules/)

If you would like to use features like [Durable
Objects](https://developers.cloudflare.com/workers/learning/using-durable-objects)
you will need to slightly change the [`worker/index.js`](./worker/index.js)
file. In ES Module workers we no longer have a `FetchEvent` object and will
need to generate something similar ourselves instead.

```js
import { createEventHandler } from "@remix-run/cloudflare-workers";

import * as build from "../build";

const handler = createEventHandler({ build })

export default {
  fetch(request, env, context) {
    const event = { request, env, waitUntil: context.waitUntil.bind(waitUntil) };
    return handler(event);
  }
}
```

**Note**: This will now be the new object passed to you if you add
a `getLoadContext` function to the `createEventHandler`.
