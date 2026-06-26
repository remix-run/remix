Added `tabs` and `tabs/primitives` exports for controlled and uncontrolled tab groups with toggle-slider active tabs, button-sized tab text, active-tab panels, keyboard activation, and bubbling tab change events.

```tsx
import { Tabs, TabList, Tab, TabPanel } from '@remix-run/ui/tabs'
;<Tabs defaultActiveTab="overview">
  <TabList aria-label="Project sections">
    <Tab name="overview">Overview</Tab>
    <Tab name="activity">Activity</Tab>
  </TabList>
  <TabPanel name="overview">Project summary.</TabPanel>
  <TabPanel name="activity">Recent changes.</TabPanel>
</Tabs>
```
