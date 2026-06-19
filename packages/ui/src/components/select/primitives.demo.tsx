import { css, type Handle } from '@remix-run/ui'
import * as popover from '@remix-run/ui/popover'
import * as select from '@remix-run/ui/select'

/**
 * @name Select Primitives
 * @description Headless select behavior with minimal local styles.
 * @layout center
 */
export default function Example(handle: Handle) {
  let value = 'remix'

  return () => (
    <div
      mix={[
        demoCss,
        select.onSelectChange((event) => {
          value = event.value ?? 'none'
          void handle.update()
        }),
      ]}
    >
      <select.Context
        defaultLabel="Choose framework"
        defaultValue="remix"
        labelSwapDelayMs={100}
        name="framework"
      >
        <button mix={[triggerCss, select.trigger()]} type="button">
          <SelectLabel />
        </button>

        <popover.Context>
          <div mix={[surfaceCss, select.popover()]}>
            <div mix={[listCss, select.list()]}>
              {frameworks.map((option) => (
                <div key={option.value} mix={[optionCss, select.option(option)]}>
                  {option.label}
                </div>
              ))}
            </div>
          </div>
        </popover.Context>

        <input mix={[hiddenInputCss, select.hiddenInput()]} />
      </select.Context>

      <p mix={valueCss}>{`value=${value}`}</p>
    </div>
  )
}

function SelectLabel(handle: Handle) {
  let context = handle.context.get(select.Context)
  return () => <span>{context.displayedLabel}</span>
}

const frameworks = [
  { label: 'Remix', value: 'remix' },
  { label: 'React Router', value: 'react-router' },
  { label: 'React', value: 'react' },
  { disabled: true, label: 'Archived', value: 'archived' },
] as const

const demoCss = css({
  display: 'grid',
  justifyItems: 'start',
  gap: '8px',
  width: 'min(100%, 18rem)',
})

const triggerCss = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: '12rem',
  height: '32px',
  border: '1px solid #cfcfcf',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#101010',
  font: '600 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: '0 10px',
  '&:focus-visible': {
    outline: '2px solid #3573f6',
    outlineOffset: '2px',
  },
})

const surfaceCss = css({
  boxSizing: 'border-box',
  margin: 0,
  border: '1px solid #cfcfcf',
  borderRadius: '6px',
  background: '#ffffff',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  padding: '4px',
  '&:popover-open': {
    display: 'block',
  },
})

const listCss = css({
  display: 'grid',
  gap: '2px',
  maxHeight: '12rem',
  overflow: 'auto',
  outline: 0,
})

const optionCss = css({
  borderRadius: '4px',
  color: '#101010',
  font: '500 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: '6px 8px',
  '&[data-highlighted="true"]': {
    background: '#eeeeee',
  },
  '&[aria-selected="true"]': {
    background: '#101010',
    color: '#ffffff',
  },
  '&[aria-disabled="true"]': {
    color: '#9a9a9a',
  },
})

const hiddenInputCss = css({
  display: 'none',
})

const valueCss = css({
  margin: 0,
  color: '#666666',
  font: '500 12px/16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
})
