import { css, type Handle } from '@remix-run/ui'
import * as combobox from '@remix-run/ui/combobox/primitives'

/**
 * @name Combobox Primitives
 * @description Headless combobox behavior with minimal local styles.
 * @layout center
 */
export default function Example(handle: Handle) {
  let value = 'none'

  return () => (
    <div
      mix={[
        demoCss,
        combobox.onComboboxChange((event) => {
          value = event.value ?? 'none'
          void handle.update()
        }),
      ]}
    >
      <label mix={labelCss} for={`${handle.id}-field`}>
        Framework
      </label>

      <combobox.Context name="framework">
        <input
          id={`${handle.id}-field`}
          mix={[inputCss, combobox.input()]}
          placeholder="Search frameworks"
        />

        <div mix={[surfaceCss, combobox.popover()]}>
          <div mix={[listCss, combobox.list()]}>
            {frameworks.map((option) => (
              <div key={option.value} mix={[optionCss, combobox.option(option)]}>
                {option.label}
              </div>
            ))}
          </div>
        </div>

        <input mix={[hiddenInputCss, combobox.hiddenInput()]} />
      </combobox.Context>

      <p mix={valueCss}>{`value=${value}`}</p>
    </div>
  )
}

const frameworks = [
  { label: 'Remix', searchValue: ['remix', 'rmx'], value: 'remix' },
  { label: 'React Router', searchValue: ['react router', 'router'], value: 'react-router' },
  { label: 'React', value: 'react' },
  { disabled: true, label: 'Archived', value: 'archived' },
]

const demoCss = css({
  display: 'grid',
  gap: '8px',
  width: 'min(100%, 18rem)',
})

const labelCss = css({
  color: '#101010',
  font: '600 12px/16px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
})

const inputCss = css({
  boxSizing: 'border-box',
  width: '100%',
  height: '32px',
  border: '1px solid #cfcfcf',
  borderRadius: '6px',
  color: '#101010',
  font: '500 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: '0 10px',
  '&:focus-visible': {
    borderColor: '#3573f6',
    outline: '2px solid #1A72FF',
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
