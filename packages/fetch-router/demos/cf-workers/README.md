# fetch-router Cloudflare Workers Example

This example is a [Cloudflare Workers](https://workers.cloudflare.com/) application that handles routing using `@remix-run/fetch-router` with data stored in a [Cloudflare D1](https://developers.cloudflare.com/d1/) database.

## Setup

1. Install dependencies:

```sh
pnpm install
```

2. Apply database migrations:

```sh
pnpm run db:migrate
```

3. Start the development server:

```sh
pnpm run dev
```

The application will be available at `http://localhost:44100`.

## Deployment

1. Create the D1 database (if it doesn't exist):

```sh
npx wrangler d1 create fetch-router-blog
```

2. Update `wrangler.jsonc` with the database ID from the previous step (replace `"local"` in `database_id`).

3. Apply migrations to the remote database:

```sh
pnpm run db:migrate --remote
```

4. Deploy the worker:

```sh
pnpm run deploy
```
