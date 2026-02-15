# @remix-run/reconciler

A plugin-driven reconciler runtime focused on:

- modular feature composition
- platform policies (`NodePolicy`) instead of hard-coded DOM behavior
- guarded scheduler/reconciler execution with root-level error events
- efficient keyed and unkeyed child reconciliation

## Status

This package is intended to be the foundation for the next-generation component reconciler. It currently ships with a testing policy (`TestNodePolicy`) and a testing-only JSX runtime.

## Core architecture

- `createReconciler(plugins, { nodePolicy })`
  - prepares plugins, creates runtime + scheduler
- `createRoot(container)`
  - returns an `EventTarget` root with `render`, `flush`, `remove`, `dispose`
- `NodePolicy`
  - host operations (`create`, `insert`, `move`, `remove`, traversal/resolve)
- plugins
  - host transforms, lifecycle hooks, queued tasks

## Error handling

Errors thrown by scheduler/reconciler/plugin/task execution are caught and dispatched as `error` events on the root.

```ts
root.addEventListener('error', (event) => {
  let reconcilerError = event as ReconcilerErrorEvent
  console.error(reconcilerError.context.phase, reconcilerError.error)
})
```

## Testing with JSX

Use the testing runtime as `jsxImportSource`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@remix-run/reconciler/testing"
  }
}
```

The testing runtime exports:

- `Fragment`
- `jsx`
- `jsxs`
- `jsxDEV`
