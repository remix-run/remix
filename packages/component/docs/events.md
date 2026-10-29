# Events

Event handling with the `on()` mixin and signal-based interruption management.

## Form Events

Common form event patterns:

```tsx
function Form(handle: Handle) {
  return () => (
    <form
      mix={[
        on('submit', (event) => {
          event.preventDefault()
          let formData = new FormData(event.currentTarget)
          // Process form data
        }),
      ]}
    >
      <input
        name="email"
        mix={[
          on('blur', (event) => {
            // Validate on blur
            let value = event.currentTarget.value
            if (!value.includes('@')) {
              event.currentTarget.setCustomValidity('Invalid email')
            }
          }),
          on('input', (event) => {
            // Clear validation on input
            event.currentTarget.setCustomValidity('')
          }),
        ]}
      />
      <button type="submit">Submit</button>
    </form>
  )
}
```

## Keyboard Events

Handle keyboard interactions:

```tsx
function KeyboardNav(handle: Handle) {
  let selectedIndex = 0
  let items = ['Apple', 'Banana', 'Cherry']

  return () => (
    <ul
      tabIndex={0}
      mix={[
        on('keydown', (event) => {
          switch (event.key) {
            case 'ArrowDown':
              event.preventDefault()
              selectedIndex = Math.min(selectedIndex + 1, items.length - 1)
              handle.update()
              break
            case 'ArrowUp':
              event.preventDefault()
              selectedIndex = Math.max(selectedIndex - 1, 0)
              handle.update()
              break
          }
        }),
      ]}
    >
      {items.map((item, i) => (
        <li key={i} mix={[css({ backgroundColor: i === selectedIndex ? '#eee' : 'transparent' })]}>
          {item}
        </li>
      ))}
    </ul>
  )
}
```
