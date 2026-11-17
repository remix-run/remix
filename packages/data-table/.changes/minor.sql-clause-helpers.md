Add shared SQL clause compilers to `@remix-run/data-table/sql-helpers` so adapters no longer need their own copies of predicate and clause compilation. `compilePredicate()`, `compileFromClause()`, `compileWhereClause()`, `compileHavingClause()`, `compileGroupByClause()`, `compileOrderByClause()`, `compileLimitOffsetClause()`, and `compileReturningClause()` take a `SqlCompileContext` that supplies the dialect's `quoteIdentifier()`, a `bindValue()` hook that records a value and returns its placeholder, and an optional `ilike` mode (`'ilike'` for native support, `'lower-like'` by default).

```ts
import { compileWhereClause } from 'remix/data-table/sql-helpers'

let values: unknown[] = []
let where = compileWhereClause(operation.where, {
  quoteIdentifier: (name) => '"' + name.replace(/"/g, '""') + '"',
  bindValue(value) {
    values.push(value)
    return '$' + values.length
  },
})
```

The `JoinClause`, `JoinType`, and `ReturningSelection` types used by these helpers are now exported from `@remix-run/data-table`.
