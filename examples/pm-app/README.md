# PM Camp Demo

A Project Management app built with [Remix](https://remix.run) 💿

- [Remix Docs](https://docs.remix.run)
- [Customer Dashboard](https://remix.run/dashboard)

## Development

This project uses Docker to run a Postgres database and Prisma to bootstrap its tables and query the data. Before moving forward you'll need to [install and run Docker](https://docs.docker.com/get-docker/). Prisma is installed locally in the project's npm dependencies.

1. [Download this directory](https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2Fremix-run%2Fremix%2Ftree%2Fmain%2Fexamples%2Fpm-app), then `cd` into the project directory:

```sh
cd pm-app
```

2. Copy `.env.example` to create a new file `.env`:

```sh
cp .env.example .env
```

3. Copy `docker-compose.example.yml` to create a new file `docker-compose.yml`:

```sh
cp docker-compose.example.yml docker-compose.yml
```

4. Create a username and password for your database in `docker-compose.yml`. You can use any values you want here. For example:

```yml
environment:
  - POSTGRES_USER=chance
  - POSTGRES_PASSWORD=yolo2022
```

5. Use the same username and password values to confingue your database URL in `.env`. [See the Prisma guide for PostgreSQL for more information.](https://www.prisma.io/docs/concepts/database-connectors/postgresql#example). For example:

```
DATABASE_URL="postgresql://chance:yolo2022@localhost:5432/pm-app?schema=public"
```

> NOTE: in a real app you wouldn't want the database URL and username/password to be committed to your repository. Those should be environment variables set via your hosting provider's dashboard/cli.

6. Install the project's dependencies with npm:

```sh
npm install
```

7. Make sure Docker is running (I like to use Docker Desktop). Once it's up, run the `db:start` script:

```sh
npm run db:start
```

8. Run the `db:reset` script to setup the project's database.

```sh
npm run db:reset
```

> **NOTE:** If you update the database schema, you'll need to run `npm run db:update` to update the tables.

9. Run the dev server to start your app on `http://localhost:3000`:

```sh
npm run dev
```
