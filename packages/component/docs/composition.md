# Composition

## Key Prop

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
      <button mix={[on('click', reverse)]}>Reverse List</button>
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

Keys should be stable and unique within the list:

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
