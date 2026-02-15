# data-model

ActiveRecord-style models for Remix built on top of `remix/data-table`.

## Features

- Class-based models with static CRUD methods
- Per-request model binding via registry
- Relation helpers (`hasMany`, `hasOne`, `belongsTo`, `hasManyThrough`)
- Inferred table names from model class names (`OrderItem` -> `order_items`)

## Installation

```sh
npm i remix
```

## Usage

```ts
import * as s from 'remix/data-schema'
import { createRouter } from 'remix/fetch-router'
import { Model, createModelRegistry } from 'remix/data-model'
import { createDatabase } from 'remix/data-table'

class User extends Model {
  static columns = {
    id: s.number(),
    email: s.string(),
  }
}

let registry = createModelRegistry({ User })
let db = createDatabase(/* adapter */)
interface BoundModels extends ReturnType<typeof registry.bind> {}

declare module 'remix/fetch-router' {
  interface RequestContext {
    models: BoundModels
  }
}

let router = createRouter({
  middleware: [
    async (context, next) => {
      context.models = registry.bind(db)
      return next()
    },
  ],
})

router.get('/users/:id', async ({ models, params }) => {
  let user = await models.User.find(Number(params.id))
  return Response.json(user)
})
```
