# Tabs

`tabs` provides styled tabs components backed by the headless tabs primitives in `remix/ui/tabs`.

Use it when you need a tablist, tab triggers, and tab panels with the default component package styling. `tabs.listStyle` and `tabs.triggerStyle` style the tab row and triggers, but panel presentation stays app-owned.

## Usage

```tsx
import { css, type Handle } from 'remix/ui'
import { Tab, Tabs, TabsList, TabsPanel } from 'remix/components/tabs'

let panel = css({
  padding: '16px',
  border: '1px solid #d6d6d6',
  borderRadius: '16px',
})

export function ProjectTabs(_handle: Handle) {
  return () => (
    <Tabs defaultValue="overview">
      <TabsList aria-label="Project sections">
        <Tab value="overview">Overview</Tab>
        <Tab value="analytics">Analytics</Tab>
        <Tab value="reports">Reports</Tab>
        <Tab value="settings">Settings</Tab>
      </TabsList>

      <TabsPanel mix={panel} value="overview">
        View your key metrics and recent project activity.
      </TabsPanel>
      <TabsPanel mix={panel} value="analytics">
        Track trends and compare performance over time.
      </TabsPanel>
      <TabsPanel mix={panel} value="reports">
        Export and review your latest reports.
      </TabsPanel>
      <TabsPanel mix={panel} value="settings">
        Manage project preferences and defaults.
      </TabsPanel>
    </Tabs>
  )
}
```

## `tabs.*`

### `tabs.Context`

The `remix/ui/tabs` primitive provides the shared coordinator for one tabs instance.

- Owns the selected tab value for uncontrolled usage.
- Accepts controlled `value` plus `onValueChange` when the app owns selection state.
- Accepts `orientation="vertical"` when the tablist should use `ArrowUp` and `ArrowDown`.

### `tabs.list()`

The `remix/ui/tabs` primitive turns the host into the tablist.

- Wires `role="tablist"`.
- Adds `aria-orientation="vertical"` when needed.

### `tabs.trigger({ value, disabled })`

The `remix/ui/tabs` primitive registers one tab trigger.

- Wires `role="tab"`, `aria-selected`, `aria-controls`, and roving `tabIndex`.
- Selects on press.
- Supports `ArrowLeft` and `ArrowRight` for horizontal lists.
- Supports `ArrowUp` and `ArrowDown` for vertical lists.
- Supports `Home` and `End`.

### `tabs.panel({ value })`

The `remix/ui/tabs` primitive turns the host into the panel for one tab value.

- Wires `role="tabpanel"` and `aria-labelledby`.
- Hides inactive panels with `hidden`.

### `onTabsChange(...)`

The listener mixin from `remix/ui/tabs` for bubbled tab selection changes.

- `event.value` is the newly selected tab value.
- `event.previousValue` is the previously selected value, or `null`.

## Convenience Components

- `Tabs` provides the default component root around `tabs.Context` from `remix/ui/tabs`.
- `TabsList` applies `tabs.list()` from `remix/ui/tabs` with `tabs.listStyle`.
- `Tab` applies `tabs.trigger(...)` from `remix/ui/tabs` with `button.baseStyle` and `tabs.triggerStyle`.
- `TabsPanel` applies `tabs.panel(...)` from `remix/ui/tabs` without adding panel styling.

## Behavior Notes

- When you do not provide `defaultValue` or controlled `value`, the first enabled tab becomes selected automatically.
- Arrow-key navigation wraps and skips disabled tabs.
- Selection follows focus during arrow-key navigation.
- The default panel contract is behavioral only. Apps own spacing, borders, backgrounds, and layout for tab panels.

## When To Use Something Else

- Use `accordion` when sections should expand and collapse independently instead of switching a single active panel.
- Use `select` or `listbox` when the control chooses a form value instead of changing visible page sections.
- Use `menu` for action lists and command surfaces.
