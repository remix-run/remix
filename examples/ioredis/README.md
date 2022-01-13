# ioredis Example

An example of [ioredis](https://github.com/luin/ioredis). It shows how to setup ioredis with Remix.

## Usages

- [Install](https://redis.io/topics/quickstart) or use your existing Redis database.
- Duplicate the local `.env.example` file to `.env` and change the REDIS_URL environment variable to your redis database URL.
- Run `$ npm install`
- Run `$ npm run dev`

## Relevant files:

- [app/utils/redis.server.ts](./app/utils/redis.server.ts) where ioredis is setup.
- [app/routes/index.tsx](./app/routes/index.tsx) where ioredis is used.

## Related Links

- [ioredis](https://github.com/luin/ioredis)

