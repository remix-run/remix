# Remix Fly Stack

- [Remix Docs](https://remix.run/docs)

## Fly Setup

1. [Install Fly](https://fly.io/docs/getting-started/installing-flyctl/)

2. Sign up and log in to Fly

```sh
flyctl auth signup
```

3. Set up your app. Change the `app` name in fly.product.toml and fly.staging.toml

4. You'll need to create a .env file in your project root for your SESSION_SECRET

```sh
echo SESSION_SECRET=$(openssl rand -hex 32) >> .env
```

## The Database

In development, it's better to use a local database, on macOS the easiest way to do this is to use [Postgres.app][postgresapp]. On Windows you can use the official Postgres [installer][windows_postgres]. If you'd prefer, you can also use Fly's Wireguard VPN to connect to a development database (or even your production database). You can find the instructions to set up Wireguard [here][fly_wireguard], and the instructions for creating a development database [here][fly_postgres].

## Development

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

This Remix Stack comes with two GitHub actions that handle automatically deploying your app to production and staging environments.

Prior to your first deployment, you'll need to make sure you have a `FLY_API_KEY` added to your GitHub repo, to do this, go to your user settings on Fly and create a new [token][fly_new_access_token], then add it to your repo secrets with the name `FLY_API_KEY`. Finally you'll need to add a `SESSION_SECRET` to your fly app secrets, to do this you can run the following commands:

```sh
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) -c fly.staging.toml
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) -c fly.production.toml
```

[postgresapp]: https://postgresapp.com/
[windows_postgres]: https://www.postgresql.org/download/windows/
[fly_wireguard]: https://fly.io/docs/reference/private-networking/#install-your-wireguard-app
[fly_postgres]: https://fly.io/docs/reference/postgres/
[fly_new_access_token]: https://web.fly.io/user/personal_access_tokens/new
