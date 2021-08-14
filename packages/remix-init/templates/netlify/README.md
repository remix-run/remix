# Welcome to Remix!

- [Remix Docs](https://docs.remix.run)
- [Customer Dashboard](https://remix.run/dashboard)

## Netlify Dev Setup

First you'll need the [Netlify CLI](https://www.netlify.com/products/dev/):

```sh
npm i -g netlify-cli
```

## Development

You will be running two processes during development when using Netlify as your server.

- Your Netlify server in one
- The Remix development server in another

```sh
# in one tab
$ netlify dev

# in another
$ npm run dev
```

Open up [http://localhost:3000](http://localhost:3000) and you should be ready to go!

If you'd rather run everything in a single tab, you can look at [concurrently](https://npm.im/concurrently) or similar tools to run both processes in one tab.

## Deploying

You will need to add your `REMIX_TOKEN` to your Netlify site's build and deploy settings:

Once that's done you can deploy!

```sh
$ npm run build
# preview deployment
$ netlify deploy

# production deployment
$ netlify deploy --prod
```
