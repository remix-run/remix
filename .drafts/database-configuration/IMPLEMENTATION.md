# Implementation Plan

- Introduce a `DatabaseResource` abstraction that owns database construction/configuration.
- Make database adapters an implementation detail of resources instead of exporting them from data-table packages.
- Keep migration APIs adapter-based for now; migration resource work will happen later.

## Steps

- [ ] Author types for `DatabaseResource`
- [ ] Write new database integration/contract tests based on `DatabaseResource` instead of adapter + `createDatabase`
- [ ] Implement `DatabaseResource`
  - Keep `createDatabase(adapter, options)` working.
- [ ] Update demos to use `DatabaseResource`
  - For demos that still need migrations, let migration setup keep using adapters temporarily while the app-facing `db` comes from the resource path.
- [ ] Compare old adapter integration contract test cases to new database resource based contract. Figure out if we need more test coverage for parity
- [ ] Remove adapter APIs from public exports.
  - Do this last, after all consumer-facing call sites use resources.
  - Keep internal adapter imports for dialect implementation tests if those tests still need low-level coverage.
- [ ] Run validation in narrow-to-broad order.
  - Start with affected package tests/typecheck.
  - Then run changed-package validation before broader repo validation if needed.
