# Tabs

`tabs` is a headless primitive for building accessible tabs with automatic activation.

Use it when you need a tablist, tab triggers, and tab panels while owning the markup and styles yourself. Styled tabs components live in `remix/components/tabs`.

## Usage

```tsx
import { css } from 'remix/ui'
import * as tabs from 'remix/ui/tabs'

let list = css({ display: 'flex', gap: '4px' })
let trigger = css({ border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 10px' })
let panel = css({ padding: '16px' })

export function ProjectTabs() {
  return () => (
    <tabs.Context defaultValue="overview">
      <div aria-label="Project sections" mix={[list, tabs.list()]}>
        <button mix={[trigger, tabs.trigger({ value: 'overview' })]}>Overview</button>
        <button mix={[trigger, tabs.trigger({ value: 'analytics' })]}>Analytics</button>
        <button mix={[trigger, tabs.trigger({ value: 'reports' })]}>Reports</button>
      </div>

      <div mix={[panel, tabs.panel({ value: 'overview' })]}>
        View your key metrics and recent project activity.
      </div>
      <div mix={[panel, tabs.panel({ value: 'analytics' })]}>
        Track trends and compare performance over time.
      </div>
      <div mix={[panel, tabs.panel({ value: 'reports' })]}>
        Export and review your latest reports.
      </div>
    </tabs.Context>
  )
}
```

## `tabs.*`

- `Context`: coordinator for one tabs instance.
- `list()`: turns the host into the tablist.
- `trigger({ value, disabled })`: registers one tab trigger.
- `panel({ value })`: turns the host into the panel for one tab value.
- `onTabsChange(...)`: event mixin for the bubbling `TabsChangeEvent`.
- `TabsChangeEvent`: event with the newly selected value and previous value.

## Behavior Notes

- When you do not provide `defaultValue` or controlled `value`, the first enabled tab becomes selected automatically.
- Arrow-key navigation wraps and skips disabled tabs.
- Selection follows focus during arrow-key navigation.
- Panels are behavioral only. Apps own spacing, borders, backgrounds, and layout.
