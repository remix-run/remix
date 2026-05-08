Optimize UI runtime hot paths.

- Fast path for plain `on()` mixins that patches host listeners in place.
- Lazy direct listener closures for event listeners managed by the runtime.
- Lazy mixin scope signals to avoid unnecessary AbortController work.
- Faster keyed reconciliation for in-order, append-only, single-removal, and pair-swap lists.
- Property-level patching for object styles during updates.
- Bulk clearing for removable child lists, with an innerHTML guard.
