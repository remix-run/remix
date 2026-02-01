# Composition

Building component trees with props, children, refs, and keys.

## Props

Props flow from parent to child through JSX attributes:

```tsx
function Parent() {
  return () => <Child message="Hello from parent" count={42} />
}

function Child() {
  return (props: { message: string; count: number }) => (
    <div>
      <p>{props.message}</p>
      <p>Count: {props.count}</p>
    </div>
  )
}
```

## Children

Components can compose other components via `children`:

```tsx
function Layout() {
  return (props: { children: RemixNode }) => (
    <div css={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header>My App</header>
      <main>{props.children}</main>
      <footer>© 2024</footer>
    </div>
  )
}

function App() {
  return () => (
    <Layout>
      <h1>Welcome</h1>
      <p>Content goes here</p>
    </Layout>
  )
}
```

## Connect Prop

Use the `connect` prop to get a reference to the DOM node after it's rendered. This is useful for DOM operations like focusing elements, scrolling, measuring dimensions, or setting up observers.

```tsx
function Form(handle: Handle) {
  let inputRef: HTMLInputElement

  return () => (
    <form>
      <input type="text" connect={(node) => (inputRef = node)} />
      <button
        on={{
          click() {
            // Focus the input from elsewhere in the form
            inputRef.focus()
          },
        }}
      >
        Focus Input
      </button>
    </form>
  )
}
```

The `connect` callback can optionally receive an `AbortSignal` as a second parameter, which is aborted when the element is removed from the DOM. Use this for cleanup operations:

```tsx
function ResizeTracker(handle: Handle) {
  let dimensions = { width: 0, height: 0 }

  return () => (
    <div
      connect={(node, signal) => {
        // Set up ResizeObserver
        let observer = new ResizeObserver((entries) => {
          let entry = entries[0]
          if (entry) {
            dimensions.width = Math.round(entry.contentRect.width)
            dimensions.height = Math.round(entry.contentRect.height)
            handle.update()
          }
        })
        observer.observe(node)

        // Clean up when element is removed
        signal.addEventListener('abort', () => {
          observer.disconnect()
        })
      }}
    >
      Size: {dimensions.width} x {dimensions.height}
    </div>
  )
}
```

The `connect` callback is called only once when the element is first rendered, not on every update.

## Key Prop

Use the `key` prop to uniquely identify elements in lists. Keys enable efficient diffing and preserve DOM nodes and component state when lists are reordered, filtered, or updated.

```tsx
function TodoList(handle: Handle) {
  let todos = [
    { id: '1', text: 'Buy milk' },
    { id: '2', text: 'Walk dog' },
    { id: '3', text: 'Write code' },
  ]

  return () => (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  )
}
```

When you reorder, add, or remove items, keys ensure:

- **DOM nodes are reused** - Elements with matching keys are moved, not recreated
- **Component state is preserved** - Component instances persist across reorders
- **Focus and selection are maintained** - Input focus stays with the same element
- **Input values are preserved** - Form values remain with their elements

```tsx
function ReorderableList(handle: Handle) {
  let items = [
    { id: 'a', label: 'Item A' },
    { id: 'b', label: 'Item B' },
    { id: 'c', label: 'Item C' },
  ]

  function reverse() {
    items = [...items].reverse()
    handle.update()
  }

  return () => (
    <div>
      <button
        on={{
          click: reverse,
        }}
      >
        Reverse List
      </button>
      {items.map((item) => (
        <div key={item.id}>
          <input type="text" defaultValue={item.label} />
        </div>
      ))}
    </div>
  )
}
```

Even when the list order changes, each input maintains its value and focus state because the `key` prop identifies which DOM node corresponds to which item.

Keys can be any type (string, number, bigint, object, symbol), but should be stable and unique within the list:

```tsx
// Good: stable, unique IDs
{
  items.map((item) => <Item key={item.id} item={item} />)
}

// Good: index can work if list never reorders
{
  items.map((item, index) => <Item key={index} item={item} />)
}

// Bad: don't use random values or values that change
{
  items.map((item) => <Item key={Math.random()} item={item} />)
}
```

## See Also

- [Context](./context.md) - Indirect composition without prop drilling
- [Animate API](./animate.md) - Keys are required for animation reclamation
