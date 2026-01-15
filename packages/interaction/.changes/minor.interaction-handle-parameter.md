BREAKING CHANGE: Interaction setup functions now receive `handle` as a parameter instead of using `this` context

Interaction setup functions now receive the `Interaction` handle as a parameter:

```ts
// Before
function MyInteraction(this: Interaction) {
  this.on(this.target, { ... })
}

// After
function MyInteraction(handle: Interaction) {
  handle.on(handle.target, { ... })
}
```

This change affects all custom interactions created with `defineInteraction()`.
