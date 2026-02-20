---
name: write-tests
description: Write high-signal tests for @remix-run/dom mixins and DOM behavior. Use when adding or refactoring mixins, fixing regressions, or strengthening confidence around prop composition and host-node effects.
---

# Write DOM Tests

Use this skill to create reliable, readable tests for `@remix-run/dom`.

## Test Strategy

Focus on observable behavior, not implementation details:

1. Arrange with the smallest tree that proves the behavior.
2. Act with one clear trigger (render, rerender, event, remove).
3. Assert only user-visible or contract-level outcomes.
4. Add regression tests for every bug fix.

## What To Validate

- Prop composition correctness (`className`, `style`, `mix`, and event handlers)
- Mixin ordering and precedence when multiple mixins are composed
- Lifecycle effects (`queueTask`, `commit`, `remove`) and cleanup behavior
- DOM node side effects only when nodes exist (and never after teardown)
- No regressions across rerenders with changed props

## Authoring Rules

1. Keep each test focused on one behavior.
2. Prefer explicit setup over shared hidden helpers.
3. Avoid brittle snapshots for dynamic DOM behavior.
4. Assert concrete DOM state and event outcomes.
5. Do not use loops or conditionals to generate tests inside `describe()` blocks.
6. Use stable test names that describe behavior and scenario.

## Common Patterns

### Verify composed props

```tsx
it('appends class names while preserving existing classes', () => {
  // arrange + act + assert...
})
```

### Verify lifecycle cleanup

```tsx
it('removes listeners on remove lifecycle', () => {
  // render, dispose, then assert no follow-up effects...
})
```

### Verify rerender behavior

```tsx
it('updates style on rerender without dropping prior props', () => {
  // initial render, rerender with new props, assert final DOM...
})
```

## Checklist Before Finishing

- [ ] New behavior is covered by at least one focused test
- [ ] Bug fixes include a failing-then-passing regression test
- [ ] Tests avoid implementation-coupled assertions
- [ ] `describe()` blocks contain explicit tests (no generated cases)
- [ ] Test names explain intent and expected outcome
- [ ] Coverage run passes for the changed area

## Validation

Run after edits:

```bash
pnpm --filter @remix-run/dom run test
pnpm --filter @remix-run/dom run test -- src/lib/mixins/css-mixin.test.tsx
pnpm --filter @remix-run/dom run test:coverage
pnpm --filter @remix-run/dom run typecheck
```
