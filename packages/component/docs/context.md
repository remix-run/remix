# Context

Read context inside render when the provider replaces its value with `context.set(...)`. A value read during setup stays the value from that setup call. A stable object, such as an event target, can be captured during setup when the provider keeps that object's identity.

## Component Identity

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

  context.addEventListener('userChange', () => handle.update(), { signal: handle.signal })

  return () => <div>{context.user?.name ?? 'Not logged in'}</div>
}
```
