Add optional table lifecycle callbacks for write/delete/read flows: `beforeWrite`, `afterWrite`, `beforeDelete`, `afterDelete`, and `afterRead`.

BREAKING CHANGE: Remove the `fail(...)` helper from the public API. Return plain `{ issues: [...] }` objects from `validate(...)`, `beforeWrite(...)`, and `beforeDelete(...)` instead.
