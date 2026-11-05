`insertMany([])` and `createMany([])` now return an empty result without calling the database adapter, so custom adapters no longer need their own empty-batch handling.
