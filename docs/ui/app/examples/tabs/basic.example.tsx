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
  padding: '20px',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#fff, #1b1b20)',
  display: 'grid',
  gap: '16px',
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
  gap: '4px',
  padding: '4px',
  borderRadius: '9px',
  background: 'light-dark(#eeeef3, #25252b)',
})

const tabCss = css({
  flex: 1,
  minWidth: 0,
  padding: '8px 12px',
  border: 0,
  borderRadius: '6px',
  background: 'transparent',
  color: 'light-dark(#202027, #eeeef2)',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  '@media (hover: hover)': {
    '&:not(:disabled):not([data-state="active"]):hover': {
      background: 'light-dark(#e0e0e7, #32323b)',
    },
  },
  '&:not(:disabled):active': { background: 'light-dark(#d8d8e1, #303038)' },
  '&[data-state="active"]': {
    background: 'light-dark(#fff, #393940)',
    color: 'light-dark(#202027, #eeeef2)',
    boxShadow: '0 1px 3px #00000018',
  },
  '&:focus-visible': { outline: '2px solid #5bb8ef' },
  '&:disabled': { color: 'light-dark(#7b7b86, #92929e)', cursor: 'default' },
})

const panelCss = css({
  padding: '4px',
  minHeight: '100px',
  '&[hidden]': { display: 'none' },
  '& p': { marginBlock: '8px 0' },
})
