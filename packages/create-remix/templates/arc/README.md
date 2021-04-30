# Welcome to Remix!

- [Remix Docs](https://docs.remix.run)
- [Customer Dashboard](https://remix.run/dashboard)

## Architect Setup

When deploying to AWS Lambda with Architect, you'll need:

- Architect (`arc`) CLI
- AWS SDK

Architect recommends installing these globally:

```sh
$ npm i -g @architect/architect aws-sdk
```

## Development

You will be running two processes during development when using Architect as your server.

- Your Architect server sandbox in one
- The Remix development server in another

```sh
# in one tab
$ arc sandbox

# in another
$ npm run dev
```

Open up [http://localhost:3333](http://localhost:3333) and you should be ready to go!

If you'd rather run everything in a single tab, you can look at [concurrently](https://npm.im/concurrently) or similar tools to run both processes in one tab.

## Deploying

Before you can deploy, you'll need to do some setup with AWS:

- First [install the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
- Then [follow the Architect setup instructions](https://arc.codes/docs/en/guides/get-started/detailed-aws-setup).

If you make it through all of that, you're ready to deploy!

1. build the app for production:

   ```sh
   $ npm run build
   ```

2. Deploy with `arc`

   ```sh
   $ arc deploy production
   ```

You're in business!
