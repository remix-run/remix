BREAKING CHANGE: Rename the top-level table-definition helper from `createTable(...)` to `table(...)` and switch column definitions to `column(...)` builders. Runtime validation is now optional and table-scoped via `validate({ operation, tableName, value })`.

Remove `~standard` table-schema compatibility and `getTableValidationSchemas(...)`, and stop runtime validation/coercion for predicate values.
