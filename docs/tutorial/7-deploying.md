---
title: Deploying
---

We are working on making deployment to different cloud service providers a breeze, but at the moment they're all in progress :\ We are actively working on starters repos to help you deploy to the following providers before the 1.0 release:

- [AWS via Architect](https://arc.codes)
- [Firebase](https://firebase.google.com)
- [Vercel](https://vercel.com)
- [Azure](https://azure.microsoft.com)
- [Cloudflare Workers](https://workers.cloudflare.com/) (probably not at 1.0)

We'll have starter templates and dedicated docs for each platform, as well as docs on general deployment strategies to anywhere (all we need is an http request handler and a place for static assets).

## Deploying an express app:

The app we just built is an express app. You can deploy this app anywhere you can deploy an express app, like [Heroku](https://heroku.com).

First run the build:

```
npm run build
```

This builds your app in two places: `build/*` for the server rendering version, and `public/build/*` for the browser.

You should now be able to run it in production mode:

```bash
NODE_ENV=production node server.js
```

## Quick Tips

Some of you adventurous folks are trying to deploy to different platforms already. Here are a few quick tips:

1. Remix dynamically requires your data modules, so if your deployment platform auto detects the files it needs by reading package.json and your main files imports, it's not going to get everything. You have to manually include them.

2. When remix boots up it reads your `app/` and `data/` directories to figure out the routes. We will probably make this a part of the build output instead, but for now, you'll need to deploy not only the build artifacts, but also the `app` and `data` source folders.

3. After all that, in the end all Remix really needs is an http handler and then point remix.config.publicPath at the static assets wherever you end up putting them.

Let us know how it goes! Good luck!
