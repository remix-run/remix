# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Netlify Setup

1. Install the [Netlify CLI](https://www.netlify.com/products/dev/):

```sh
npm i -g netlify-cli
```

2. Sign up and log in to Netlify:

```sh
  netlify login
```

3. Create a new site:

```sh
  netlify init
```

4. You'll need to tell Netlify to use Node 14, as at the time of writing Netlify uses Node 12 by [default](https://docs.netlify.com/functions/build-with-javascript/#runtime-settings)

```sh
  netlify env:set AWS_LAMBDA_JS_RUNTIME nodejs14.x
```

## Development

You will be running two processes during development when using Netlify as your server.

- Your Netlify server in one
- The Remix development server in another

```sh
# in one tab
$ npm run dev:netlify

# in another
$ npm run dev
```

Open up [http://localhost:3000](http://localhost:3000), and you should be ready to go!

If you'd rather run everything in a single tab, you can look at [concurrently](https://npm.im/concurrently) or similar tools to run both processes in one tab.

## Deployment

There are two ways to deploy your app to Netlify, you can either link your app to your git repo and have it auto deploy changes to Netlify, or you can deploy your app manually. If you've followed the setup instructions already, all you need to do is run this:

```sh
$ npm run build
# preview deployment
$ netlify deploy

# production deployment
$ netlify deploy --prod
```
