# Future

## Revisit app database file conventions

The Remix CLI likely needs a stable convention for loading the app's `DatabaseResource`, such as `app/data/database.ts`. Before cementing this, revisit whether database-related files should live under `app/data/*` or use top-level app modules like `app/database.ts` and `app/models.ts` instead of `app/data/database.ts` and `app/data/schema.ts`.
