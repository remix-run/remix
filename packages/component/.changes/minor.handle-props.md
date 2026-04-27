BREAKING CHANGE: Components now receive props through a stable `handle.props` object using `Handle<Props, Context>` instead of receiving a separate `setup` argument and render callback props. Move initialization values that previously used `<Component setup={...} />` onto regular props, and read all props from `handle.props` in both the component function and render callback.

Before:

```tsx
function Counter(handle: Handle<CounterContext>, setup: { initialCount: number }) {
  let count = setup.initialCount

  return (props: { label: string }) => (
    <button>
      {props.label}: {count}
    </button>
  )
}

;<Counter setup={{ initialCount: 10 }} label="Count" />
```

After:

```tsx
function Counter(handle: Handle<{ initialCount: number; label: string }, CounterContext>) {
  let count = handle.props.initialCount

  return () => (
    <button>
      {handle.props.label}: {count}
    </button>
  )
}

;<Counter initialCount={10} label="Count" />
```

The `handle.props` object keeps the same identity for the component lifetime while its values are updated before each render, so destructuring `let { props, update } = handle` remains safe. The `setup` prop is no longer special and is treated like any other prop.

This also removes the old pattern where setup-scope helpers had to read from a mutable variable that was reassigned inside the render callback:

```tsx
function Listbox(handle: Handle<ListboxContext>) {
  let props: ListboxProps

  function select(value: string) {
    props.onSelect(value)
  }

  handle.context.set({ select })

  return (nextProps: ListboxProps) => {
    props = nextProps
    return props.children
  }
}
```

Helpers can now read the current props directly from the stable handle:

```tsx
function Listbox(handle: Handle<ListboxProps, ListboxContext>) {
  function select(value: string) {
    handle.props.onSelect(value)
  }

  handle.context.set({ select })

  return () => handle.props.children
}
```
