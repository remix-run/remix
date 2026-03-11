Add optional table lifecycle callbacks for write/delete/read flows: `beforeWrite`, `afterWrite`, `beforeDelete`, `afterDelete`, and `afterRead`.

Add `fail(...)` as a helper for returning structured validation/lifecycle issues from `validate(...)`, `beforeWrite(...)`, and `beforeDelete(...)`.
