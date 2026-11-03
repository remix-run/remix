import { Portal } from '@remix-run/ui/portal'
import { css, type Handle } from '@remix-run/component'
import * as combobox from '@remix-run/ui/combobox'

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
        combobox.onComboboxChange((event) => {
          value = event.value ?? 'none'
          void handle.update()
        }),
        css({
          display: 'grid',
          gap: '8px',
          width: 'min(100%, 18rem)',
        }),
      ]}
    >
      <label
        mix={css({
          color: 'light-dark(#151515, #ececec)',
          font: '600 12px/16px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
          letterSpacing: 0,
        })}
        for={`${handle.id}-field`}
      >
        Framework
      </label>

      <combobox.Context name="framework">
        <input
          id={`${handle.id}-field`}
          mix={[
            combobox.input(),
            css({
              boxSizing: 'border-box',
              width: '100%',
              height: '32px',
              border: '1px solid light-dark(#d1d1d1, #444444)',
              borderRadius: '6px',
              color: 'light-dark(#151515, #ececec)',
              font: '500 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
              letterSpacing: 0,
              padding: '0 10px',
              '&:focus-visible': {
                borderColor: 'light-dark(#3573f6, #6eaaff)',
                outline: '2px solid light-dark(#1A72FF, #6eaaff)',
              },
            }),
          ]}
          placeholder="Search frameworks"
        />

        <Portal>
          <div
            mix={[
              combobox.popover(),
              css({
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
            ]}
          >
            <div
              mix={[
                combobox.list(),
                css({
                  display: 'grid',
                  gap: '2px',
                  maxHeight: '12rem',
                  overflow: 'auto',
                  outline: 0,
                }),
              ]}
            >
              {frameworks.map((option) => (
                <div
                  key={option.value}
                  mix={[
                    combobox.option(option),
                    css({
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
                  ]}
                >
                  {option.label}
                </div>
              ))}
            </div>
          </div>
        </Portal>

        <input
          mix={[
            combobox.hiddenInput(),
            css({
              display: 'none',
            }),
          ]}
        />
      </combobox.Context>

      <p
        mix={css({
          margin: 0,
          color: 'light-dark(#6d6d6d, #b3b3b3)',
          font: '500 12px/16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        })}
      >{`value=${value}`}</p>
    </div>
  )
}

const frameworks = [
  { label: 'Remix', searchValue: ['remix', 'rmx'], value: 'remix' },
  { label: 'React Router', searchValue: ['react router', 'router'], value: 'react-router' },
  { label: 'React', value: 'react' },
  { disabled: true, label: 'Archived', value: 'archived' },
]
