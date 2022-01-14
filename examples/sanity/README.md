# Sanity Example!

You can follow the original guide from Simeon Griggs's [guide on sanity](https://www.sanity.io/guides/remix-run-live-preview). And do not forget to like the guide.

- [Remix Docs](https://docs.remix.run)

## Development

From your terminal:

```sh
npm run dev
```
In another terminal:
```sh
cd studio
npm install
sanity start
```

## Note

Get your ProjectID from **studio/sanity.json** and paste it in **app/lib/config.js**


This starts your app in development mode, rebuilding assets on file changes.

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

If you're familiar with deploying node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `remix build`

- `build/`
- `public/build/`


