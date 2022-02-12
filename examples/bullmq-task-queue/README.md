# Bullmq Example

An example of how to setup [bullmq](https://github.com/taskforcesh/bullmq) with Remix. Our redis connection is provided by the [ioredis example](../ioredis) and can be referenced for more information.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/bullmq-task-queue)

## Usages

- Use your existing redis server or [install new redis server](https://redis.io/topics/quickstart) or [start redis server with docker](https://hub.docker.com/_/redis).
- Duplicate the local `.env.example` file to `.env` and change the REDIS_URL environment variable to your redis server URL.
- Run `$ npm install`
- Run `$ npm run dev`

## Relevant files:

- [app/utils/notifier.server.ts](./app/queues/notifier.server.ts) where we define the necessary components for the background task queue, worker, and scheduler.
- [app/routes/index.tsx](./app/routes/index.tsx) where background tasks are added to the queue.

## Related Links

- [bullmq](https://github.com/taskforcesh/bullmq)
- [ioredis](https://github.com/luin/ioredis)
