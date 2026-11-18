import { css, type Handle } from '@remix-run/component'
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
        select.onSelectChange((event) => {
          value = event.value ?? 'none'
          void handle.update()
        }),
        styles.root,
      ]}
    >
      <select.Context
        defaultLabel="Choose framework"
        defaultValue="remix"
        labelSwapDelayMs={100}
        name="framework"
      >
        <button mix={[select.trigger(), styles.trigger]} type="button">
          <SelectLabel />
        </button>

        <select.Portal>
          <select.PopoverContext>
            <div mix={[select.popover(), styles.popover]}>
              <div mix={[select.list(), styles.list]}>
                {frameworks.map((option) => (
                  <div key={option.value} mix={[select.option(option), styles.option]}>
                    {option.label}
                  </div>
                ))}
              </div>
            </div>
          </select.PopoverContext>
        </select.Portal>

        <input mix={[select.hiddenInput(), styles.hiddenInput]} />
      </select.Context>

      <p mix={styles.description}>{`value=${value}`}</p>
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

const styles = {
  root: css({
    display: 'grid',
    justifyItems: 'start',
    gap: '8px',
    width: 'min(100%, 18rem)',
  }),
  trigger: css({
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: '12rem',
    height: '32px',
    border: '1px solid light-dark(#d1d1d1, #444444)',
    borderRadius: '6px',
    background: 'light-dark(#ffffff, #1a1a1a)',
    color: 'light-dark(#151515, #ececec)',
    font: '600 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    letterSpacing: 0,
    padding: '0 10px',
    '&:focus-visible': {
      outline: '2px solid light-dark(#3573f6, #6eaaff)',
      outlineOffset: '2px',
    },
  }),
  popover: css({
    boxSizing: 'border-box',
    margin: 0,
    border: '1px solid light-dark(#d1d1d1, #444444)',
    borderRadius: '6px',
    background: 'light-dark(#ffffff, #1a1a1a)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    padding: '4px',
    '&[data-open]': {
      display: 'block',
    },
  }),
  list: css({
    display: 'grid',
    gap: '2px',
    maxHeight: '12rem',
    overflow: 'auto',
    outline: 0,
  }),
  option: css({
    borderRadius: '4px',
    color: 'light-dark(#151515, #ececec)',
    font: '500 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    letterSpacing: 0,
    padding: '6px 8px',
    '&[data-highlighted="true"]': {
      background: 'light-dark(#eeeeee, #2c2c2c)',
    },
    '&[aria-selected="true"]': {
      background: 'light-dark(#101010, #ececec)',
      color: 'light-dark(#ffffff, #151515)',
    },
    '&[aria-disabled="true"]': {
      color: 'light-dark(#9a9a9a, #666666)',
    },
  }),
  hiddenInput: css({
    display: 'none',
  }),
  description: css({
    margin: 0,
    color: 'light-dark(#6d6d6d, #b3b3b3)',
    font: '500 12px/16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  }),
}
