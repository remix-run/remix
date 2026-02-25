---
name: close-test-coverage-gaps
description: Closes failing test coverage thresholds. Use when coverage is below target, when a user asks to raise coverage, or when deciding between adding tests vs removing unreachable defensive branches.
---

# Close Test Coverage Gaps

## Goal

Raise coverage to configured thresholds with the smallest safe change set.

Default policy:

- Prefer public API coverage paths first.
- Avoid tests that only target private helpers.
- If a branch is unreachable through public behavior and only guards internal bugs, replace with `invariant` or remove the branch.

## Fast Workflow

1. Run package coverage first, not whole repo.
2. Identify the metric failing threshold (usually branches).
3. Target the lowest-value uncovered branches that are reachable through public APIs.
4. If coverage still misses and uncovered code is dead/internal-only, simplify or remove that code path.
5. Re-run coverage and lints.

## Coverage Command Strategy

- Use the project's existing coverage command for the specific target module/package first.
- Avoid running whole-repo coverage unless required by project policy.
- Keep runs focused so feedback loops stay fast.

## Decision Rules

### Add tests when:

- Behavior is observable via public runtime APIs.
- Branches represent real user-facing scenarios (reload races, malformed inputs at boundaries, feature switches).

### Simplify/remove branches when:

- Branch cannot be triggered through supported public behavior.
- Branch exists only to defend internal state that should be invariant.
- Keeping the branch increases complexity with no runtime value.

Use this pattern for internal assumptions:

```ts
invariant(condition, 'descriptive internal invariant message')
```

## Coverage Triage Heuristics

- Prioritize files with low branch % that are central to threshold misses.
- Prefer one high-leverage test over many micro-tests.
- Cover race/abort paths with deterministic tests (fake timers, controlled promises/streams).
- Reuse existing integration suites before creating new isolated suites.

## Validation Checklist

- [ ] Coverage command exits 0 for the target package.
- [ ] Branches/lines/functions/statements all meet configured threshold.
- [ ] New tests assert behavior, not implementation details.
- [ ] No linter errors in changed files.
- [ ] Unreachable defensive branches were removed only with clear rationale.

## Output Expectations

When reporting back:

- Include exact coverage result and failing/passing metric.
- List changed files.
- State whether fixes came from public behavior tests, internal branch pruning, or both.
