import { css } from '@remix-run/ui'
import { Tab, Tabs, TabsList, TabsPanel } from '@remix-run/ui/components/tabs'

/**
 * @name Tabs
 * @description Styled tabs components backed by the headless tabs primitives.
 * @layout center
 */
export default function Example() {
  return () => (
    <Tabs defaultValue="overview">
      <TabsList aria-label="Project sections">
        <Tab value="overview">Overview</Tab>
        <Tab value="activity">Activity</Tab>
        <Tab disabled value="reports">
          Reports
        </Tab>
        <Tab value="settings">Settings</Tab>
      </TabsList>

      <TabsPanel mix={panelCss} value="overview">
        Review status, ownership, and the next scheduled milestone.
      </TabsPanel>
      <TabsPanel mix={panelCss} value="activity">
        Track recent changes and handoffs from the project team.
      </TabsPanel>
      <TabsPanel mix={panelCss} value="reports">
        Reports are disabled until the first export finishes.
      </TabsPanel>
      <TabsPanel mix={panelCss} value="settings">
        Configure notifications, permissions, and default project views.
      </TabsPanel>
    </Tabs>
  )
}

const panelCss = css({
  width: 'min(100vw - 48px, 31rem)',
  boxSizing: 'border-box',
  marginTop: '12px',
  padding: '16px',
  border: '1px solid rgba(16, 16, 16, 0.08)',
  borderRadius: '12px',
  backgroundColor: '#FFFFFF',
  boxShadow: '0 8px 24px -16px rgba(16, 16, 16, 0.32)',
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '13px',
  lineHeight: '20px',
  fontWeight: 500,
  letterSpacing: 0,
  color: '#101010',
})
