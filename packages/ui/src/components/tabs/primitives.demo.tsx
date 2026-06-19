import { css } from '@remix-run/ui'
import * as tabs from '@remix-run/ui/tabs'

/**
 * @name Tabs Primitives
 * @description Headless tabs behavior with minimal local styles.
 * @layout center
 */
export default function Example() {
  return () => (
    <tabs.Context defaultValue="overview">
      <div mix={demoCss}>
        <div aria-label="Project sections" mix={[listCss, tabs.list()]}>
          <button mix={[tabCss, tabs.trigger({ value: 'overview' })]} type="button">
            Overview
          </button>
          <button mix={[tabCss, tabs.trigger({ value: 'activity' })]} type="button">
            Activity
          </button>
          <button mix={[tabCss, tabs.trigger({ disabled: true, value: 'reports' })]} type="button">
            Reports
          </button>
        </div>

        <div mix={[panelCss, tabs.panel({ value: 'overview' })]}>
          Current owner, milestone, and project health.
        </div>
        <div mix={[panelCss, tabs.panel({ value: 'activity' })]}>
          Recent changes and review handoffs.
        </div>
        <div mix={[panelCss, tabs.panel({ value: 'reports' })]}>
          Reports are disabled until the first export finishes.
        </div>
      </div>
    </tabs.Context>
  )
}

const demoCss = css({
  display: 'grid',
  gap: '8px',
  width: 'min(100%, 24rem)',
})

const listCss = css({
  display: 'flex',
  gap: '4px',
  borderBlockEnd: '1px solid #d8d8d8',
})

const tabCss = css({
  appearance: 'none',
  border: 0,
  borderBlockEnd: '2px solid transparent',
  background: 'transparent',
  color: '#555555',
  font: '600 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: '8px 10px',
  '&[aria-selected="true"]': {
    borderBlockEndColor: '#3573f6',
    color: '#101010',
  },
  '&[aria-disabled="true"]': {
    color: '#a0a0a0',
  },
  '&:focus-visible': {
    outline: '2px solid #3573f6',
    outlineOffset: '-2px',
  },
})

const panelCss = css({
  border: '1px solid #d8d8d8',
  borderRadius: '6px',
  color: '#4f4f4f',
  font: '500 13px/20px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: '12px',
})
