# Context

Context enables components to communicate without direct prop passing.

## Basic Context

Use `handle.context.set()` to provide values and `handle.context.get()` to consume them:

```tsx
function ThemeProvider(handle: Handle<{ children?: RemixNode }, { theme: 'light' | 'dark' }>) {
  let theme: 'light' | 'dark' = 'light'

  handle.context.set({ theme })

  return () => (
    <div>
      <button
        mix={[
          on('click', () => {
            theme = theme === 'light' ? 'dark' : 'light'
            handle.context.set({ theme })
            handle.update()
          }),
        ]}
      >
        Toggle Theme
      </button>
      {handle.props.children}
    </div>
  )
}

function ThemedContent(handle: Handle) {
  let { theme } = handle.context.get(ThemeProvider)

  return () => (
    <div mix={[css({ backgroundColor: theme === 'dark' ? '#000' : '#fff' })]}>
      Current theme: {theme}
    </div>
  )
}
```

**Important:** `handle.context.set()` does not cause any updates—it simply stores a value. If you want the component tree to update when context changes, you must call `handle.update()` after setting the context (as shown above).

## Component Identity

Context lookup is keyed by component identity. `handle.context.get(Component)` reads the nearest ancestor instance whose component function is exactly `Component`, and the returned value is inferred from that component's `Handle<Props, ContextValue>` type.

This keeps component relationships explicit and avoids accidental collisions between unrelated providers. Nested instances of the same provider component shadow outer instances, but different component types remain independent even when their context values have the same shape.

When multiple public components should provide the same logical scope, create a shared provider component and render it from each public component:

```tsx
type MenuScopeValue = {
  id: string
}

function MenuScope(handle: Handle<{ children?: RemixNode }, MenuScopeValue>) {
  handle.context.set({ id: handle.id })
  return () => handle.props.children
}

function MenuRoot(handle: Handle<{ children?: RemixNode }>) {
  return () => <MenuScope>{handle.props.children}</MenuScope>
}

function MenuGroup(handle: Handle<{ children?: RemixNode }>) {
  return () => <MenuScope>{handle.props.children}</MenuScope>
}

function MenuTrigger(handle: Handle) {
  let scope = handle.context.get(MenuScope)
  return () => <button aria-controls={scope.id}>Open</button>
}
```

## TypedEventTarget for Granular Updates

For better performance, use `TypedEventTarget` to avoid updating the entire subtree. This allows descendants to subscribe to specific changes rather than re-rendering on every parent update:

```tsx
import { TypedEventTarget } from 'remix/ui'

class Theme extends TypedEventTarget<{ change: Event }> {
  #value: 'light' | 'dark' = 'light'

  get value() {
    return this.#value
  }

  setValue(value: 'light' | 'dark') {
    this.#value = value
    this.dispatchEvent(new Event('change'))
  }
}

function ThemeProvider(handle: Handle<{ children?: RemixNode }, Theme>) {
  let theme = new Theme()
  handle.context.set(theme)

  return () => (
    <div>
      <button
        mix={[
          on('click', () => {
            // No update needed - consumers subscribe to changes
            theme.setValue(theme.value === 'light' ? 'dark' : 'light')
          }),
        ]}
      >
        Toggle Theme
      </button>
      {handle.props.children}
    </div>
  )
}

function ThemedContent(handle: Handle) {
  let theme = handle.context.get(ThemeProvider)

  // Subscribe to granular updates
  addEventListeners(theme, handle.signal, {
    change() {
      handle.update()
    },
  })

  return () => (
    <div mix={[css({ backgroundColor: theme.value === 'dark' ? '#000' : '#fff' })]}>
      Current theme: {theme.value}
    </div>
  )
}
```

Benefits of this pattern:

- **No unnecessary re-renders**: Only components that subscribe to changes are updated
- **Decoupled updates**: The provider doesn't need to call `handle.update()` when context changes
- **Type-safe events**: `TypedEventTarget` ensures event handlers receive the correct event types

## Context with Multiple Values

Provide multiple related values through context:

```tsx
class AppContext extends TypedEventTarget<{ userChange: Event; settingsChange: Event }> {
  #user: User | null = null
  #settings: Settings = defaultSettings

  get user() {
    return this.#user
  }

  get settings() {
    return this.#settings
  }

  setUser(user: User | null) {
    this.#user = user
    this.dispatchEvent(new Event('userChange'))
  }

  setSettings(settings: Settings) {
    this.#settings = settings
    this.dispatchEvent(new Event('settingsChange'))
  }
}

function AppProvider(handle: Handle<{ children?: RemixNode }, AppContext>) {
  let context = new AppContext()
  handle.context.set(context)

  return () => handle.props.children
}

// Components can subscribe to only the events they care about
function UserDisplay(handle: Handle) {
  let context = handle.context.get(AppProvider)

  addEventListeners(context, handle.signal, {
    userChange() {
      handle.update()
    },
  })

  return () => <div>{context.user?.name ?? 'Not logged in'}</div>
}
```

## See Also

- [Handle API](./handle.md) - `handle.context` reference
- [Events](./events.md) - `addEventListeners()` for subscribing to EventTargets
