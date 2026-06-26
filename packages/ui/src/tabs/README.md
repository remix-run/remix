# tabs

`Tabs` renders a tab control with one active tab and matching panels. Use it when related views share the same page space and the owning component may either control the active tab or let the tabs context manage it.

## Component Usage

```tsx
import { Tabs, TabList, Tab, TabPanel } from 'remix/ui/tabs'

export function ProjectTabs() {
  return (
    <Tabs defaultActiveTab="overview">
      <TabList aria-label="Project sections">
        <Tab name="overview">Overview</Tab>
        <Tab name="activity">Activity</Tab>
        <Tab name="settings">Settings</Tab>
      </TabList>

      <TabPanel name="overview">Project summary.</TabPanel>
      <TabPanel name="activity">Recent changes.</TabPanel>
      <TabPanel name="settings">Project settings.</TabPanel>
    </Tabs>
  )
}
```

Control the active tab when state should live in the owning component:

```tsx
import type { Handle } from 'remix/ui'
import { Tabs, TabList, Tab, TabPanel } from 'remix/ui/tabs'

export function ControlledTabs(handle: Handle) {
  let activeTab = 'overview'

  return () => (
    <Tabs
      activeTab={activeTab}
      onActiveTabChange={(nextActiveTab) => {
        activeTab = nextActiveTab
        void handle.update()
      }}
    >
      <TabList aria-label="Project sections">
        <Tab name="overview">Overview</Tab>
        <Tab name="activity">Activity</Tab>
      </TabList>

      <TabPanel name="overview">Project summary.</TabPanel>
      <TabPanel name="activity">Recent changes.</TabPanel>
    </Tabs>
  )
}
```

Listen for bubbling `TabsChangeEvent` events with `onTabsChange` from `remix/ui/tabs/primitives`.

```tsx
import { onTabsChange } from 'remix/ui/tabs/primitives'
import { Tabs, TabList, Tab, TabPanel } from 'remix/ui/tabs'

export function TrackedTabs() {
  return (
    <div
      mix={[
        onTabsChange((event) => {
          console.log(event.previousActiveTab, event.activeTab)
        }),
      ]}
    >
      <Tabs defaultActiveTab="overview">
        <TabList aria-label="Project sections">
          <Tab name="overview">Overview</Tab>
          <Tab name="activity">Activity</Tab>
        </TabList>
        <TabPanel name="overview">Project summary.</TabPanel>
        <TabPanel name="activity">Recent changes.</TabPanel>
      </Tabs>
    </div>
  )
}
```

## Primitive Usage

Use the lower-level primitives when app code owns the markup and styles:

```tsx
import * as tabs from 'remix/ui/tabs/primitives'
import { listStyle, panelStyle, rootStyle, tabStyle } from './tabs.styles'

export function PrimitiveTabs() {
  return (
    <tabs.Context defaultActiveTab="overview">
      <div mix={[rootStyle, tabs.root()]}>
        <div mix={[listStyle, tabs.list()]} aria-label="Project sections">
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

## `remix/ui/tabs`

- `Tabs`: root component. Supports controlled `activeTab`, uncontrolled `defaultActiveTab`, `onActiveTabChange`, `disabled`, and `size: 'md' | 'lg'`.
- `TabList`: tablist wrapper that lays out the tabs in a track and applies the tablist primitive.
- `Tab`: button for one tab `name`. The active tab uses the toggle slider treatment and button-sized text. Pass `disabled` to prevent activation.
- `TabPanel`: panel for one tab `name`.
- `rootStyle`, `listStyle`, `tabStyle`, and `panelStyle`: flat style mixins used by the component markup.
- `onTabsChange` and `TabsChangeEvent`: re-exported primitive event helpers.
- `TabsProps`, `TabListProps`, `TabProps`, `TabPanelProps`, and `TabsSize`: public TypeScript types for the composed APIs.

## `remix/ui/tabs/primitives`

- `Context`: lower-level provider for custom tabs composition.
- `root()`: wires the root element and bubbling change events.
- `list()`: wires the tablist role and disabled state.
- `tab({ name, disabled })`: wires a tab button with selected state, ids, keyboard activation, and pointer activation.
- `panel({ name })`: wires the matching tab panel id, hidden state, inert state, and label relationship.
- `onTabsChange(...)`: event mixin for the bubbling `TabsChangeEvent`.
- `TabsChangeEvent`: bubbling event with `activeTab` and `previousActiveTab`.
- `TabsContextProps`, `TabsContextValue`, `TabsRegisteredTab`, `TabsActivationDirection`, `TabsRootOptions`, `TabListOptions`, `TabOptions`, and `TabPanelOptions`: primitive prop and option types for custom composition.

## Behavior Notes

- If neither `activeTab` nor `defaultActiveTab` is provided, the first enabled tab becomes active.
- Arrow keys activate the next or previous enabled tab. `Home` and `End` activate the first and last enabled tabs.
- `Enter`, `Space`, and pointer clicks activate the focused tab.
- Root `disabled` disables every tab. Tab `disabled` only disables that tab.
- Tabs and panels are linked with generated ids through `aria-controls`, `aria-labelledby`, and `aria-selected`.
- Inactive panels receive `hidden`, `inert`, and `data-state="inactive"`.
