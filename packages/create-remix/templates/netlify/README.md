# Welcome to Remix!

- [Remix Docs](https://docs.remix.run)
- [Customer Dashboard](https://remix.run/dashboard)

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

4. **Important**: Netlify is going to do an `npm install` when you deploy your app. This template assumes your Remix token is available as an environment variable named `REMIX_TOKEN` for both npm installs on your computer and on Netlify. Open up your terminal rc file and add this:

```sh
  # .zshrc, .profile, .bash_rc, etc.
  export REMIX_TOKEN="your token here"
```

After you've done that, either open a new terminal tab or run source ~/.zshrc (or whatever your rc file is) to get the new env var available in your shell. Now you can run a local npm install.

```sh
  npm i
```

5. You'll need to tell Netlify to use Node 14, as at the time of writing Netlify uses Node 12 by [default](https://docs.netlify.com/functions/build-with-javascript/#runtime-settings)

```sh
  netlify env:set AWS_LAMBDA_JS_RUNTIME nodejs14.x
```

6. Lastly, you'll need to tell Netlify about your token as well:

```sh
  netlify env:set REMIX_TOKEN ${REMIX_TOKEN}
```

You can use this for other secrets too, like stripe tokens and database urls.

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

There are two ways to deploy your app to Netlify, you can either link your app to your git repo and have it auto deploy changes to Netlify, or you can deploy your app manually. If you've followed the setup instructions already, especially the REMIX_TOKEN environment variable step, all you need to do is run this:

```sh
$ npm run build
# preview deployment
$ netlify deploy

# production deployment
$ netlify deploy --prod
```
