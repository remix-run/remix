---
title: "@remix-run/serve"
order: 3
---

# Remix App Server

While you can bring your own server, Remix ships with a built-in, production ready application server.

```sh
remix-serve <server-build-path>
```

Depending on `process.env.NODE_ENV`, the server will boot in development or production mode.

The `server-build-path` needs to point to the `serverBuildDirectory` defined in `remix.config.js`.

Because only the build artifacts (`build/`, `public/build/`) need to be deployed to production, the `remix.config.js` is not guaranteed to be available in production, so you need to tell Remix where your server build is with this option.

In development, `remix-serve` will ensure the latest code is run on each request by purging the require cache of your application modules when files change. This has some effects on your code you might need to be aware of:

- Any values in the module scope will be "reset"

  ```ts [1-3]
  // this will be reset whenever any files change because the module cache was
  // cleared and this will be required brand new
  const cache = new Map();

  export async function loader({ params }) {
    if (cache.has(params.foo)) {
      return json(cache.get(params.foo));
    }

    const record = await fakeDb.stuff.find(params.foo);
    cache.set(params.foo, res);
    return json(record);
  }
  ```

  This should be fine, just be aware that `cache` will be empty after file changes.

- Any **module side effects** will remain in place! This may cause problems, but should probably be avoided anyway.

  ```ts [3-7]
  import { json } from "remix";

  // this starts running the moment the module is imported
  setInterval(() => {
    console.log(Date.now());
  }, 1000);

  export async function loader() {
    // ...
  }
  ```

  If you need to write your code in a way that has these types of module side-effects, you should set up your own [@remix-run/express](adapter#createrequesthandler) server and a tool in development like pm2-dev or nodemon to restart the server on file changes instead.

In production this doesn't happen. The server boots up and that's the end of it.
