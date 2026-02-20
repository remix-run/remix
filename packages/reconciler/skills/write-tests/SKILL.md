---
name: write-tests
description: Write robust tests for @remix-run/reconciler runtime behavior. Use when adding plugins, changing scheduling/commit logic, or fixing lifecycle and typing regressions.
---

# Write Reconciler Tests

Use this skill to author behavior-first tests for `@remix-run/reconciler`.

## Test Strategy

Design tests around public runtime contracts:

1. Arrange a minimal plugin/runtime setup.
2. Trigger one operation (mount, update, commit, remove, schedule).
3. Assert externally visible behavior and callback ordering.
4. Add regression coverage for each fixed defect.

## What To Validate

- Plugin hook ordering and invocation counts
- Root lifecycle semantics across mount/update/remove
- Commit and scheduling behavior under rerenders
- Cleanup guarantees for removed nodes/resources
- Type-level behavior when adding/changing public generics or helpers

## Authoring Rules

1. Prefer small, isolated tests over broad scenario tests.
2. Assert ordering explicitly when order is part of the contract.
3. Keep fake plugins minimal and purpose-built per test.
4. Avoid tests coupled to internal private state.
5. Do not use loops or conditionals to generate tests inside `describe()` blocks.
6. For type behavior, use dedicated type tests with precise expectations.

## Common Patterns

### Hook ordering

```tsx
it('calls plugin hooks in commit order', async () => {
  // arrange plugin spies, run commit, assert ordered calls...
})
```

### Rerender scheduling

```tsx
it('coalesces scheduled work across rapid updates', async () => {
  // update multiple times, flush, assert final callbacks...
})
```

### Type-level contract

```ts
it('preserves inferred node type for plugin handle', () => {
  // compile-time expectation test...
})
```

## Checklist Before Finishing

- [ ] New behavior is proven with focused runtime tests
- [ ] Ordering assertions exist where ordering is contractual
- [ ] Regression tests exist for every bug fix
- [ ] Type-level changes are covered by dedicated type tests
- [ ] `describe()` blocks contain explicit tests (no generated cases)
- [ ] Coverage run passes for the changed area

## Validation

Run after edits:

```bash
pnpm --filter @remix-run/reconciler run test
pnpm --filter @remix-run/reconciler run test -- src/lib/mix-plugin.test.tsx
pnpm --filter @remix-run/reconciler run test:coverage
pnpm --filter @remix-run/reconciler run typecheck
```
