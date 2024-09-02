# Remix + Deno

Welcome to the Deno template for Remix! 🦕

For more, check out the [Remix docs](https://remix.run/docs).

## Managing dependencies

- ✅ You should use `deno add` to add packages
  ```sh
  deno add npm:react
  ```
  ```ts
  import { useState } from "react";
  ```
- ✅ You may use inlined URL imports, JSR imports or NPM imports for Deno
  modules outside `app/`.
  ```ts
  import { copy } from "https://deno.land/std@0.138.0/streams/conversion.ts";
  ```
- ✅ You may use Deno and Node built-ins for both Deno modules outside `app/`
  and server-only Remix code within `app/`.
  ```ts filename=app/entry.server.tsx
  Deno.env.get("DENO_DEPLOYMENT_ID");
  ```
  ```ts filename=app/entry.server.tsx
  import fs from "node:fs";
  ```
- ✅ You may use
  [import maps](https://docs.deno.com/runtime/manual/basics/import_maps) for
  Deno modules outside `app/`.

## Development

From your terminal:

```sh
deno task dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Production

First, build your app for production:

```sh
deno task build
```

Then run the app in production mode:

```sh
deno task start
```

The server used for production is located in `server.production.ts`. It is
served by `deno serve` for maximum performance.

## Deployment

Building the Deno app (`deno task build`) results in two outputs:

- `build/server` (server bundle)
- `build/client` (browser bundle)

You can deploy these bundles to any host that runs Deno, but here we'll focus on
deploying to [Deno Deploy](https://deno.com/deploy).

### Setting up Deno Deploy

1. [Sign up](https://dash.deno.com/signin) for Deno Deploy.

2. [Create a new Deno Deploy project](https://dash.deno.com/new) for this app.

3. Replace `<your deno deploy project>` in the `deploy` script in `package.json`
   with your Deno Deploy project name:

```json filename=package.json
{
  "scripts": {
    "deploy": "deployctl deploy --project=<your deno deploy project> --include=build,server-prod.ts ./server.prod.ts"
  }
}
```

4. [Create a personal access token](https://dash.deno.com/account) for the Deno
   Deploy API and export it as `DENO_DEPLOY_TOKEN`:

```sh
export DENO_DEPLOY_TOKEN=<your Deno Deploy API token>
```

You may want to add this to your `rc` file (e.g. `.bashrc` or `.zshrc`) to make
it available for new terminal sessions, but make sure you don't commit this
token into `git`. If you want to use this token in GitHub Actions, set it as a
GitHub secret.

5. Install the Deno Deploy CLI,
   [`deployctl`](https://github.com/denoland/deployctl):

```sh
deno install -Arf jsr:@deno/deployctl
```

6. If you have previously installed the Deno Deploy CLI, you should update it to
   the latest version:

```sh
deployctl upgrade
```

### Deploying to Deno Deploy

After you've set up Deno Deploy, run:

```sh
deno task deploy
```
