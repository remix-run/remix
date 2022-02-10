# ioredis Example

An example of how to setup [ioredis](https://github.com/luin/ioredis) with Remix.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/ioredis)

## Usages

- Use your existing redis server or [install new redis server](https://redis.io/topics/quickstart) or [start redis server with docker](https://hub.docker.com/_/redis).
- Duplicate the local `.env.example` file to `.env` and change the REDIS_URL environment variable to your redis server URL.
- Run `$ npm install`
- Run `$ npm run dev`

## Relevant files:

- [app/utils/redis.server.ts](./app/utils/redis.server.ts) where ioredis is setup.
- [app/routes/index.tsx](./app/routes/index.tsx) where ioredis is used.

## Related Links

- [ioredis](https://github.com/luin/ioredis)

