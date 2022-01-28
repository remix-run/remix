# Remix Fly Stack

- [Remix Docs](https://remix.run/docs)

## Fly Setup

1. [Install Fly](https://fly.io/docs/getting-started/installing-flyctl/)

2. Sign up and log in to Fly

```sh
flyctl auth signup
```

3. You'll need to create a .env file in your project root for your SESSION_SECRET

```sh
$ cp .env.example .env
$ echo SESSION_SECRET=$(openssl rand -hex 32) >> .env
```

## The Database

In development, it's better to use a local database, The easiest way to do this is using [Docker][docker]. To start your postgres database, run the following command:

```sh
$ docker-compose up
```

That may take a moment to start up as it needs to get the postgres image from the Docker registry, after it's done, you'll need to migrate your database

```sh
$ prisma migrate deploy
```

If you'd prefer not to use Docker, you can also use Fly's Wireguard VPN to connect to a development database (or even your production database). You can find the instructions to set up Wireguard [here][fly_wireguard], and the instructions for creating a development database [here][fly_postgres].

## Development

From a new tab in your terminal:

```sh
$ npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

This Remix Stack comes with two GitHub actions that handle automatically deploying your app to production and staging environments.

Prior to your first deployment, you'll need to do a few thing:

- Create two apps on Fly, one for staging and one for production:

  ```sh
  $ fly create remix-fly-stack-staging
  $ fly create remix-fly-stack
  ```

- Make sure you have a `FLY_API_KEY` added to your GitHub repo, to do this, go to your user settings on Fly and create a new [token][fly_new_access_token], then add it to your repo secrets with the name `FLY_API_KEY`. Finally you'll need to add a `SESSION_SECRET` to your fly app secrets, to do this you can run the following commands:

  ```sh
  fly secrets set SESSION_SECRET=$(openssl rand -hex 32) -c fly.staging.toml
  fly secrets set SESSION_SECRET=$(openssl rand -hex 32) -c fly.production.toml
  ```

- Create a database for both your staging and production environments. Run the following for both of your environments and follow the prompts:

  ```sh
  $ fly postgres create
  ```

  afterwards, you'll need to connect your database to each of your apps

  ```sh
  $ fly postgres attach --postgres-app <the name of your db> --app <the name of your app>
  ```

  Fly will take care of setting the DATABASE_URL secret for you.

[docker]: https://www.docker.com/get-started
[fly_wireguard]: https://fly.io/docs/reference/private-networking/#install-your-wireguard-app
[fly_postgres]: https://fly.io/docs/reference/postgres/
[fly_new_access_token]: https://web.fly.io/user/personal_access_tokens/new
