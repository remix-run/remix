---
name: reconciler-plugin-api-plan-v2
overview: Build a brand-new reconciler/plugin system with a JSX-first test harness, using a delete-and-rewrite strategy for prior DOM prototype code unless specific pieces are proven worth salvaging.
todos:
  - id: lock-rewrite-spec
    content: Phase 1 - Update architecture doc with rewrite-first policy, plugin phases, and consumed-prop model
    status: completed
  - id: implement-plugin-core
    content: Phase 2 - Implement routing, consumed-prop tracking, and slot lifecycle in new reconciler core
    status: completed
  - id: build-test-node-reconciler
    content: Phase 3 - Add in-memory TestNodePolicy and TestNodeReconciler render/flush/inspect helpers with illegal-operation invariants
    status: completed
  - id: build-testing-jsx-runtime
    content: Phase 3 - Implement minimal testing jsx/jsxs/Fragment runtime and dev-runtime exports
    status: completed
  - id: author-jsx-tests
    content: Phase 3 - Write reconciliation validation tests (complex mixed trees, children composition, updates, replacements, keyed/unkeyed moves, keyed replacements, inserts) plus perf/lifecycle checks
    status: completed
  - id: implement-dom-package
    content: Phase 4 - Implement terminal DOM plugin behavior in packages/dom (form-state, aria/data, fallback)
    status: pending
  - id: delete-obsolete-prototype
    content: Phase 5 - Delete obsolete prior prototype paths once replacements are validated
    status: pending
isProject: false
---

# Reconciler Plugin System Build Plan (Rewrite-First)

## Goal

Build a brand-new reconciler/plugin architecture and testing surface, with a **rewrite-first** approach:

- prefer deleting old prototype paths and rebuilding cleanly,
- salvage only small, proven pieces when reuse is lower risk than rewrite,
- keep behavior deterministic and performance-oriented from day one.

## Scope

- Core architecture/spec updates in [packages/reconciler/architecture.md](/Users/ryan/remix-run/remix/packages/reconciler/architecture.md)
- New reconciler implementation in [packages/reconciler/src/lib](/Users/ryan/remix-run/remix/packages/reconciler/src/lib)
- New testing harness/runtime in [packages/reconciler/src/testing](/Users/ryan/remix-run/remix/packages/reconciler/src/testing)
- Phase-4 DOM implementation in `packages/dom` for terminal behavior (form-state, aria/data, fallback)
- Prior prototype references in [packages/dom/src/lib](/Users/ryan/remix-run/remix/packages/dom/src/lib) used only as optional inspiration, not migration targets

## Rewrite-First Policy

- Default action for prior prototype code in `packages/dom`: **delete and reimplement**.
- Salvage criteria (must meet all):
  - isolated utility logic (no hidden coupling),
  - behavior already validated by tests or straightforward to validate,
  - no API shape mismatch with the new reconciler contract,
  - no perf penalty from adaptation layers.
- If criteria are not met, rewrite directly in new reconciler/plugin modules.

## Target Plugin Contract

- Keep `definePlugin(...)` entrypoint with explicit metadata:
  - `phase: 'special' | 'terminal'`
  - `priority?: number`
  - `routing?: { keys?: string[]; shapeBits?: number }`
- Use consumed-prop tracking instead of mutating `input.props`:
  - `consume(key)`/bitmask tracking in `special` phase
  - terminal plugin reads `remainingPropsView`
- Use slot/state lifecycle to avoid per-host closures:
  - `initRoot` / `mountHost` / `commitHost` / `unmountHost`

## Execution Model

1. Reconciler computes prop keys/shape.
2. Route-table selects `special` plugin candidates.
3. If no candidates and no active slots, take zero-allocation fast path.
4. Special plugins run in deterministic order and mark consumed props.
5. Terminal rest-props behavior is added in Phase 4 in the DOM package.
6. Active slots tracked by plugin ID for O(active) updates and teardown.

```mermaid
flowchart TD
  hostInput[HostInput] --> routeCompile[RouteTableLookup]
  routeCompile --> specialPhase[SpecialPhasePlugins]
  specialPhase --> consumedState[ConsumedPropsState]
  consumedState --> commitDone[CommitComplete]
  commitDone --> activeIndex[ActiveSlotsByPluginId]
```

## Test Harness and JSX Runtime

- Build `TestNodeReconciler` in `packages/reconciler/src/testing` with:
  - in-memory `TestNodePolicy`,
  - root create/render/flush/dispose helpers,
  - inspectable tree output and lifecycle event logs,
  - DOM-like parent/child/sibling bookkeeping plus invariant checks that fail fast on illegal operations (invalid anchors, cross-parent moves, duplicate ownership, remove of non-child).
- Build minimal JSX runtime for tests:
  - `jsx`, `jsxs`, `Fragment` in `jsx-runtime.ts`,
  - dev variant in `jsx-dev-runtime.ts`,
  - convenience re-exports in `jsx.ts`.
- Use JSX as the default authoring style in reconciler/plugin tests.

Example target usage:

```ts
import { jsx, Fragment } from '@remix-run/reconciler/testing/jsx-runtime'
import { createTestNodeReconciler } from '@remix-run/reconciler/testing'

let root = createTestNodeReconciler().createRoot()
root.render(
  <Fragment>
    <view value="x" data-id="123" />
  </Fragment>
)
```

Simple update trigger pattern for tests:

```ts
let capturedUpdate = () => {}
function MyComp(handle: { update(): void }) {
  capturedUpdate = () => {
    // update some state
    handle.update()
  }
  return <view />
}
```

## Implementation Phases

- Phase 1: Finalize architecture/spec language for rewrite-first model and plugin phases.
- Phase 2: Implement new reconciler plugin execution core (routing, consumed props, slot lifecycle).
- Phase 3: Add post-phase-2 validation in `TestNodeReconciler` and JSX tests, including perf/lifecycle validation (fast path, sparse/dense props, teardown-heavy updates):
  - complex mixed trees (host + component nodes),
  - children composition and nesting behavior,
  - component-triggered updates via captured `handle.update()`,
  - replacements, unkeyed moves, keyed moves, keyed replacements, and inserts.
- Phase 4: Implement terminal DOM package behavior (`packages/dom`) for form-state, aria/data, and fallback handling.
- Phase 5: Remove obsolete prototype code paths where replacement is complete.

## Validation

- Correctness:
  - phase and priority ordering,
  - complex mixed host/component tree reconciliation and children composition,
  - replacements, unkeyed moves, keyed moves, keyed replacements, and inserts,
  - inactive-active-inactive transitions,
  - unmount teardown determinism,
  - exception safety (`commitHost` failure still tears down owned resources),
  - illegal host operation detection in `TestNodePolicy` invariants.
- Performance:
  - no-special-prop fast path,
  - sparse special props,
  - dense mixed props (reconciler core only),
  - mount/update/unmount churn.

## Risks and Mitigations

- Rewriting too broadly without guardrails:
  - Mitigation: salvage criteria + explicit completion checkpoints.
- Contract churn during early implementation:
  - Mitigation: lock core plugin interfaces before broad plugin authoring.
- Hidden regressions from behavior parity assumptions:
  - Mitigation: behavior-driven tests in `TestNodeReconciler` before DOM integration.
