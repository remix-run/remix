import { css, type Handle } from 'remix/ui'
import * as button from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import * as listbox from '@remix-run/ui/listbox'
import * as popover from '@remix-run/ui/popover'
import * as select from '@remix-run/ui/select'
import { theme } from '@remix-run/ui/theme'

let selectExampleCss = css({
  width: '16rem',
})

let environmentOptions = [
  { label: 'Local', value: 'local' },
  { label: 'Staging', value: 'staging' },
  { label: 'Production', value: 'production' },
  { disabled: true, label: 'Archived', value: 'archived' },
] as const

export default function Example(handle: Handle) {
  let label = 'Local'
  let value = 'local'
  let triggerId = `${handle.id}-trigger`

  return () => (
    <div
      mix={[
        stackCss,
        select.onSelectChange((event) => {
          label = event.label ?? 'Select an environment'
          value = event.value ?? 'null'
          void handle.update()
        }),
      ]}
    >
      <p mix={labelCss}>Environment</p>

      <select.Context defaultLabel="Local" defaultValue="local" name="environment">
        <button
          id={triggerId}
          type="button"
          mix={[button.baseStyle, select.triggerStyle, select.trigger(), selectExampleCss]}
        >
          <span mix={button.labelStyle}>{label}</span>
          <Glyph mix={button.iconStyle} name="chevronVertical" />
        </button>

        <popover.Context>
          <div mix={[popover.surfaceStyle, select.popover()]}>
            <div
              aria-labelledby={triggerId}
              mix={[popover.contentStyle, listbox.listStyle, select.list()]}
            >
              {environmentOptions.map((option) => (
                <div key={option.value} mix={[listbox.optionStyle, select.option(option)]}>
                  <Glyph mix={listbox.glyphStyle} name="check" />
                  <span mix={listbox.labelStyle}>{option.label}</span>
                </div>
              ))}
            </div>
          </div>
        </popover.Context>

        <input mix={select.hiddenInput()} />
      </select.Context>

      <p mix={valueCss}>{`value=${value}`}</p>
    </div>
  )
}

let stackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  width: '100%',
})

let labelCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

let valueCss = css({
  margin: 0,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
})
