import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import * as tabs from '@remix-run/ui/tabs'

export default function Example(handle: Handle) {
  let activeTab = 'overview'
  return () => (
    <div mix={stackCss}>
      <tabs.Context
        activeTab={activeTab}
        onActiveTabChange={(next) => {
          activeTab = next
          handle.update()
        }}
      >
        <div mix={[cardCss, tabs.root()]}>
          <div aria-label="Project sections" mix={[tabListCss, tabs.list()]}>
            <button type="button" mix={[tabCss, tabs.tab({ name: 'overview' })]}>
              Overview
            </button>
            <button type="button" mix={[tabCss, tabs.tab({ name: 'activity' })]}>
              Activity
            </button>
          </div>
          <div mix={[panelCss, tabs.panel({ name: 'overview' })]}>
            <strong>Website refresh</strong>
            <p mix={mutedCss}>Design review is ready. The next milestone is due next week.</p>
          </div>
          <div mix={[panelCss, tabs.panel({ name: 'activity' })]}>
            <strong>Latest activity</strong>
            <p mix={mutedCss}>Alex shared updated designs. Morgan approved the navigation.</p>
          </div>
        </div>
      </tabs.Context>
      <button
        type="button"
        disabled={activeTab === 'activity'}
        mix={[
          buttonCss,
          on('click', () => {
            activeTab = 'activity'
            handle.update()
          }),
        ]}
      >
        View latest activity
      </button>
    </div>
  )
}

const stackCss = css({
  colorScheme: 'light dark',
  width: '320px',
  maxWidth: '100%',
  display: 'grid',
  gap: '16px',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})

const cardCss = css({
  padding: '20px',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#fff, #1b1b20)',
  display: 'grid',
  gap: '16px',
})

const mutedCss = css({ margin: 0, fontSize: '12px', color: 'light-dark(#62626c, #b0b0bb)' })

const buttonCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '9px 14px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #25252b)',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  '&:hover:not(:disabled)': { background: 'light-dark(#f0f0f5, #303038)' },
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '3px' },
  '&:disabled': { opacity: 0.45, cursor: 'default' },
})

const tabListCss = css({
  display: 'flex',
  gap: '4px',
  padding: '4px',
  borderRadius: '9px',
  background: 'light-dark(#eeeef3, #25252b)',
})

const tabCss = css({
  flex: 1,
  padding: '8px 12px',
  border: 0,
  borderRadius: '6px',
  background: 'transparent',
  color: 'light-dark(#62626c, #b0b0bb)',
  font: 'inherit',
  cursor: 'pointer',
  '&[data-state="active"]': {
    background: 'light-dark(#fff, #393940)',
    color: 'light-dark(#202027, #eeeef2)',
    boxShadow: '0 1px 3px #00000018',
  },
  '&:focus-visible': { outline: '2px solid #5bb8ef' },
  '&:disabled': { opacity: 0.4, cursor: 'default' },
})

const panelCss = css({
  padding: '4px',
  minHeight: '100px',
  '&[hidden]': { display: 'none' },
  '& p': { marginBlock: '8px 0' },
})
