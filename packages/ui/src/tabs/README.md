# tabs

`tabs` provides headless tab registration, keyboard navigation, selection, and panel relationships. App code owns the markup and visual styles.

## Usage

```tsx
import * as tabs from '@remix-run/ui/tabs'
import { listStyle, panelStyle, rootStyle, tabStyle } from './tabs.styles'

export function ProjectTabs() {
  return (
    <tabs.Context defaultActiveTab="overview">
      <div mix={[rootStyle, tabs.root()]}>
        <div aria-label="Project sections" mix={[listStyle, tabs.list()]}>
          <button mix={[tabStyle, tabs.tab({ name: 'overview' })]} type="button">
            Overview
          </button>
          <button mix={[tabStyle, tabs.tab({ name: 'activity' })]} type="button">
            Activity
          </button>
        </div>

        <div mix={[panelStyle, tabs.panel({ name: 'overview' })]}>Project summary.</div>
        <div mix={[panelStyle, tabs.panel({ name: 'activity' })]}>Recent changes.</div>
      </div>
    </tabs.Context>
  )
}
```

Control the active tab when state should live in the owning component:

```tsx
import type { Handle } from 'remix/component'
import * as tabs from '@remix-run/ui/tabs'

export function ControlledTabs(handle: Handle) {
  let activeTab = 'overview'

  return () => (
    <tabs.Context
      activeTab={activeTab}
      onActiveTabChange={(nextActiveTab) => {
        activeTab = nextActiveTab
        void handle.update()
      }}
    >
      {/* tab list and panels */}
    </tabs.Context>
  )
}
```

Listen for bubbling changes on the root or an ancestor:

```tsx
<div
  mix={tabs.onTabsChange((event) => {
    console.log(event.previousActiveTab, event.activeTab)
  })}
>
  {/* tabs */}
</div>
```

## `@remix-run/ui/tabs`

- `Context`: provider for controlled `activeTab` or uncontrolled `defaultActiveTab`. It also supports `onActiveTabChange` and root-level `disabled` state.
- `root()`: wires the root element and bubbling change events.
- `list()`: wires the tablist role and disabled state.
- `tab({ name, disabled })`: wires a tab button with selected state, ids, keyboard activation, and pointer activation.
- `panel({ name })`: wires the matching tab panel id, hidden state, inert state, and label relationship.
- `onTabsChange(...)`: event mixin for the bubbling `TabsChangeEvent`.
- `TabsChangeEvent`: bubbling event with `activeTab` and `previousActiveTab`.
- `TabsContextProps`, `TabsContextValue`, `TabsRegisteredTab`, `TabsActivationDirection`, `TabsRootOptions`, `TabListOptions`, `TabOptions`, and `TabPanelOptions`: context, state, and mixin option types.

## Behavior Notes

- If neither `activeTab` nor `defaultActiveTab` is provided, the first enabled tab becomes active.
- Arrow keys activate the next or previous enabled tab. `Home` and `End` activate the first and last enabled tabs.
- `Enter`, Space, and pointer clicks activate the focused tab.
- Root `disabled` disables every tab. Tab `disabled` only disables that tab.
- Tabs and panels are linked with generated ids through `aria-controls`, `aria-labelledby`, and `aria-selected`.
- Inactive panels receive `hidden`, `inert`, and `data-state="inactive"`.
