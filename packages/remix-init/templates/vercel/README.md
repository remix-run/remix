# Welcome to Remix!

- [Remix Docs](https://docs.remix.run)
- [Customer Dashboard](https://remix.run/dashboard)

## Vercel Setup

First you'll need the [Vercel CLI](https://vercel.com/docs/cli):

```sh
npm i -g vercel
```

Before you can run the app in development, you need link this project to a new Vercel project on your account.

**It is important that you use a new project. If you try to link this project to an existing project (like a Next.js site) you will have problems.**

```sh
$ vercel link
```

Follow the prompts, and when its done you should be able to get started.

## Development

You will be running two processes during development when using Vercel as your server.

- Your Vercel server in one
- The Remix development server in another

```sh
# in one tab
$ vercel dev

# in another
$ npm run dev
```

Open up [http://localhost:3000](http://localhost:3000) and you should be ready to go!

If you'd rather run everything in a single tab, you can look at [concurrently](https://npm.im/concurrently) or similar tools to run both processes in one tab.

## Deploying

You will need to add your npmrc with your Remix token to your server's environment:

When you ran `npm init remix`, we probably created an npmrc in your home directory. Go take a look, it should look something like this:

```
//npm.remix.run/:_authToken={your-token}
@remix-run:registry=https://npm.remix.run
```

If it looks something like that, then you can run these commands to add your npmrc from the command line:

```bash
$ vercel env add NPM_RC development < ~/.npmrc
$ vercel env add NPM_RC preview < ~/.npmrc
$ vercel env add NPM_RC production < ~/.npmrc
```

You can also add this environment variable in your vercel project dashboard.

Once that's done you can deploy!

```sh
$ npm run build
# preview deployment
$ vercel

# production deployment
$ vercel --prod
```

### GitHub Automatic Deployments

For some reason the GitHub integration doesn't deploy the public folder. We're working with Vercel to figure this out.

For now, [you can set up a GitHub action with this config](https://gist.github.com/mcansh/91f8effda798b41bb373351fad217070) from our friend @mcansh.
