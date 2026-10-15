import { css } from 'remix/component'
import * as tabs from '@remix-run/ui/tabs'

export default function Example() {
  return () => (
    <div mix={stackCss}>
      <tabs.Context defaultActiveTab="details">
        <div mix={[cardCss, tabs.root()]}>
          <div aria-label="File information" mix={[tabListCss, tabs.list()]}>
            <button type="button" mix={[tabCss, tabs.tab({ name: 'details' })]}>
              Details
            </button>
            <button type="button" mix={[tabCss, tabs.tab({ name: 'version' })]}>
              Version
            </button>
          </div>
          <div mix={[panelCss, tabs.panel({ name: 'details' })]}>
            <dl mix={detailsCss}>
              <dt>File</dt>
              <dd>report.pdf</dd>
              <dt>Size</dt>
              <dd>240 KB</dd>
            </dl>
          </div>
          <div mix={[panelCss, tabs.panel({ name: 'version' })]}>
            <dl mix={detailsCss}>
              <dt>Version</dt>
              <dd>2</dd>
              <dt>Author</dt>
              <dd>Alex Morgan</dd>
            </dl>
          </div>
        </div>
      </tabs.Context>
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
  overflow: 'hidden',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#fff, #1b1b20)',
})

const detailsCss = css({
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '8px 24px',
  margin: 0,
  '& dt': { color: 'light-dark(#62626c, #b0b0bb)' },
  '& dd': { margin: 0 },
})

const tabListCss = css({
  display: 'flex',
  borderBottom: '1px solid light-dark(#e0e0e6, #393940)',
  background: 'light-dark(#f6f6f9, #25252b)',
})

const tabCss = css({
  flex: 1,
  minWidth: 0,
  padding: '14px 12px',
  border: 0,
  background: 'transparent',
  color: 'light-dark(#202027, #eeeef2)',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  '@media (hover: hover)': {
    '&:not(:disabled):not([data-state="active"]):hover': {
      background: 'light-dark(#eeeef3, #303038)',
    },
  },
  '&:not(:disabled):active': { background: 'light-dark(#e6e6ed, #393940)' },
  '&[data-state="active"]': {
    background: 'light-dark(#fff, #1b1b20)',
    color: 'light-dark(#202027, #eeeef2)',
    boxShadow: 'inset 0 -1px light-dark(#62626c, #b0b0bb)',
  },
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '-4px' },
  '&:disabled': { color: 'light-dark(#7b7b86, #92929e)', cursor: 'not-allowed' },
})

const panelCss = css({
  padding: '24px',
  '&[hidden]': { display: 'none' },
})
