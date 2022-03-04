# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)


## Development

Both Remix and Architect have their own local servers, each of which is responsible for unique tasks related to local development.

To start both alongside one another, run:

```sh
$ npm run dev
```

Open up [http://localhost:3333](http://localhost:3333) and you should be ready to go!


### TypeScript

To develop in TypeScript, install Architect's official TS plugin:

```sh
$ npm i @architect/plugin-typescript
```

Then add the following to the `app.arc` file:

```arc
@plugins
architect/plugin-typescript

@aws
runtime typescript
```


## Deploying

Before you can deploy, you'll need to do some setup with AWS:

- First [install the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
- Then [follow the Architect setup instructions](https://arc.codes/docs/en/guides/get-started/detailed-aws-setup).

Once you make it through all of that, you're ready to deploy!

1. Build the app for production:

   ```sh
   $ npm run build
   ```

2. Deploy with `arc`

   ```sh
   $ npx arc deploy production
   ```

You're in business!
