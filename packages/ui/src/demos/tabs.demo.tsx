import { css } from '@remix-run/component'
import * as tabs from '@remix-run/ui/tabs'

/**
 * @name Tabs Primitives
 * @description Headless tabs behavior with app-owned markup and minimal local styles.
 * @layout center
 */
export default function Example() {
  return () => (
    <tabs.Context defaultActiveTab="overview">
      <div mix={[rootCss, tabs.root()]}>
        <div aria-label="Project sections" mix={[listCss, tabs.list()]}>
          <button mix={[tabCss, tabs.tab({ name: 'overview' })]} type="button">
            Overview
          </button>
          <button mix={[tabCss, tabs.tab({ name: 'activity' })]} type="button">
            Activity
          </button>
          <button mix={[tabCss, tabs.tab({ disabled: true, name: 'settings' })]} type="button">
            Settings
          </button>
        </div>

        <div mix={[panelCss, tabs.panel({ name: 'overview' })]}>
          Project health, owner notes, and current milestones.
        </div>
        <div mix={[panelCss, tabs.panel({ name: 'activity' })]}>
          Recent commits, deploys, and review handoffs.
        </div>
        <div mix={[panelCss, tabs.panel({ name: 'settings' })]}>
          Visibility, notifications, and billing preferences.
        </div>
      </div>
    </tabs.Context>
  )
}

const rootCss = css({
  display: 'grid',
  gap: '12px',
  width: 'min(100%, 28rem)',
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})

const listCss = css({
  display: 'flex',
  gap: '4px',
  borderBlockEnd: '1px solid light-dark(#d1d1d1, #444444)',
})

const tabCss = css({
  appearance: 'none',
  border: 0,
  borderBlockEnd: '2px solid transparent',
  background: 'transparent',
  color: 'light-dark(#6d6d6d, #b3b3b3)',
  font: '600 13px/18px inherit',
  letterSpacing: 0,
  padding: '8px 10px',
  '&[data-state="active"]': {
    borderBlockEndColor: 'light-dark(#151515, #ececec)',
    color: 'light-dark(#151515, #ececec)',
  },
  '&:disabled': {
    opacity: 0.4,
  },
  '&:focus-visible': {
    outline: '2px solid light-dark(#3573f6, #6eaaff)',
    outlineOffset: '-2px',
  },
})

const panelCss = css({
  color: 'light-dark(#4f4f4f, #b3b3b3)',
  fontSize: '13px',
  lineHeight: '20px',
  padding: '4px 10px',
})
