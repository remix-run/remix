# Prisma Example

In this example, we will setup Prisma with Remix.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/template)

## Example

Prisma is a next-generation ORM that can be used to query a database. It embraces TypeScript to avoid runtime errors and improve productivity. The type-safety it provides goes far beyond the guarantees of traditional ORMs like TypeORM or Sequelize. It integrates well with Remix. As of today, Prisma supports PostgreSQL, MySQL, SQLite, SQL Server, MongoDB.

### Configuration

In [/app/services/db.server.ts](app/services/db.server.ts), the database connection is export globally. You can access it anywhere from code.

Now this example is setup and ready to with SQLite, but you can also configure any of the supported databases.

#### To configure another data source navigate to [/prisma/schema.prisma](./prisma/schema.prisma)

```javascript

// Using SQLite
datasource db {
provider = "sqlite"
url = env("DATABASE_URL")
}

// Preferred
datasource db {
provider = "sqlite" // change sqlite to your preferred data source. Except for MongoDB.
url = env("DATABASE_URL")
}

// Using MongoDB
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")

}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["mongoDb"]

}
```

#### Change your environment variables in [.env](.env)

```.env
// Using SQLite default settings.
DATABASE_URL="file:./dev.db"

// Using another data source.
DATABASE_URL="file:./dev.db" // your database url.

```

Define your own data models in [prisma/schema.prisma](prisma/schema.prisma)

Once you've updated your data models, you can execute the changes against your database with the following command:

```bash
npx prisma db push
```

## Related Links

- Read [Prisma](https://www.prisma.io/docs/) Docs.
- Kent C. Dodds [Jokes App](https://remix.run/docs/en/v1/tutorials/jokes#set-up-prisma) shows you how to use Prisma with Remix using SQLite.
