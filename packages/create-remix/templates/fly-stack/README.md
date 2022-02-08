# Remix Fly Stack

- [Remix Docs](https://remix.run/docs)

## Before you get started

Note apps on Fly require a globally unique name, in this repo our initializer script will use the name of the current directory, plus 4 random characters, you can change this at anytime BEFORE you deploy. Run this command to update relevant files with the name of your app (the current directory)

```sh
node scripts/init.mjs
```

## Fly Setup

1. [Install Fly](https://fly.io/docs/getting-started/installing-flyctl/)

2. Sign up and log in to Fly

```sh
flyctl auth signup
```

3. You'll need to create a .env file in your project root for your SESSION_SECRET

```sh
cp .env.example .env
echo SESSION_SECRET=$(openssl rand -hex 32) >> .env
```

## The Database

In development, it's better to use a local database, The easiest way to do this is using [Docker][docker]. To start your postgres database, first make sure you have docker running, then run the following command:

```sh
docker-compose up
```

That may take a moment to start up as it needs to get the postgres image from the Docker registry, after it's done, you'll need to migrate your database. With the database ready to accept connections, open a new tab and run this:

```sh
npx prisma migrate deploy
```

When this finishes successfully, it will say:

> "All migrations have been successfully applied."

If you'd prefer not to use Docker, you can also use Fly's Wireguard VPN to connect to a development database (or even your production database). You can find the instructions to set up Wireguard [here][fly_wireguard], and the instructions for creating a development database [here][fly_postgres].

## Development

With your postgres database up and running in one tab and setup with tables for your data model via prisma, you're ready to start the dev server. Run this in a new tab in your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

This is a pretty simple note-taking app, but it's a good example of how you can build a full stack app with Prisma and Remix. The main functionality is creating users, logging in and out, and creating and deleting notes.

### Relevant code:

- creating users, and logging in and out [./app/models/user.server.ts](./app/models/user.server.ts)
- user sessions, and verifying them [./app/session.server.ts](./app/session.server.ts)
- creating, and deleting notes [./app/models/note.server.ts](./app/models/note.server.ts)

## Deployment

This Remix Stack comes with two GitHub actions that handle automatically deploying your app to production and staging environments.

Prior to your first deployment, you'll need to do a few thing:

- Create a new [GitHub Repository](https://repo.new)

- Create two apps on Fly, one for staging and one for production:

  ```sh
  fly create [YOUR_APP_NAME]-staging
  fly create [YOUR_APP_NAME]
  ```

- Make sure you have a `FLY_API_TOKEN` added to your GitHub repo, to do this, go to your user settings on Fly and create a new [token][fly_new_access_token], then add it to your repo secrets with the name `FLY_API_TOKEN`. Finally you'll need to add a `SESSION_SECRET` to your fly app secrets, to do this you can run the following commands:

  ```sh
  fly secrets set SESSION_SECRET=$(openssl rand -hex 32) -c fly.staging.toml
  fly secrets set SESSION_SECRET=$(openssl rand -hex 32) -c fly.production.toml
  ```

  If you don't have openssl installed, you can also use [1password][generate_password] to generate a random secret, just replace `$(openssl rand -hex 32)` with the generated secret.

- Create a database for both your staging and production environments. Run the following for both of your environments and follow the prompts (your App name is "[YOUR_APP_NAME]-db"):

  ```sh
  fly postgres create
  ```

  afterwards, you'll need to connect your database to each of your apps

  ```sh
  fly postgres attach --postgres-app [YOUR_APP_NAME]-db --app [YOUR_APP_NAME]
  ```

  Fly will take care of setting the DATABASE_URL secret for you.

Now that every is set up you can commit and push your changes to your repo. Every commit to your `main` branch will trigger a deployment to your production environment, and every commit to your `dev` branch will trigger a deployment to your staging environment.

[docker]: https://www.docker.com/get-started
[fly_wireguard]: https://fly.io/docs/reference/private-networking/#install-your-wireguard-app
[fly_postgres]: https://fly.io/docs/reference/postgres/
[fly_new_access_token]: https://web.fly.io/user/personal_access_tokens/new
[generate_password]: https://1password.com/generate-password
