# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

You will be utlizing Deno in watch mode. This is already wired up in your package.json as the `dev` script:

```sh
# start the remix dev server and your deno app in watch mode
$ npm run dev
```

Open up [http://127.0.0.1:8000](http://127.0.0.1:8000) and you should be ready to go!

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying deno applications you should be right at home just make sure to deploy the output of `remix build`

- `build/`
- `public/build/`
