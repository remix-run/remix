# Welcome to Remix!

- [Remix Docs](https://docs.remix.run)
- [Customer Dashboard](https://remix.run/dashboard)

## Fly Setup

1. [Install Fly](https://fly.io/docs/getting-started/installing-flyctl/)

2. Sign up and log in to Fly

   ```sh
   flyctl auth signup
   ```

3. Setup Fly. It might ask if you want to deploy, say no since you haven't built the app yet.

   ```sh
   flyctl launch
   ```

4. **Important**: Fly is going to do an `npm install` when you deploy your app. This template assumes you have your Remix token available as an environment variable named `REMIX_TOKEN` for both npm installs on your computer and on Fly's servers. Open up your terminal rc file and add this:

   ```sh
   # .zshrc, .profile, .bash_rc, etc.
   export REMIX_TOKEN = "your token here"
   ```

   After you've done that, either open a new terminal tab or run `source ~/.zshrc` (or whatever your rc file is) to get the new env var available in your shell. Now you can run a local `npm install`.

   ```sh
   npm i
   ```

5. Lastly, you'll need to tell Fly about your token as well:

   ```sh
   flyctl secrets set REMIX_TOKEN=${REMIX_TOKEN}
   ```

   You can use this for other secrets too, like stripe tokens and database urls.

## Development

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

If you've followed the setup instructions already, especially the REMIX_TOKEN environment variable step, all you need to do is run this:

```sh
npm run deploy
```

You can run `flyctl info` to get the url and ip address of your server.

Check out the [fly docs](https://fly.io/docs/getting-started/node/) for more information.
