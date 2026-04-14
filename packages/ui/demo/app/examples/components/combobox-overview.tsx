import { css, type Handle } from 'remix/component'
import { Combobox, ComboboxOption, onComboboxChange } from '@remix-run/ui/combobox'
import { theme } from '@remix-run/ui/theme'
import { airportOptions } from './combobox-airport-options.ts'
let comboboxExampleCss = css({
  width: '16rem',
})

export default function Example(handle: Handle) {
  let value: string | null = null

  return () => (
    <div mix={stackCss}>
      <div mix={fieldCss}>
        <label for="environment-combobox" mix={labelCss}>
          Airport
        </label>

        <Combobox
          inputId="environment-combobox"
          mix={[
            comboboxExampleCss,
            onComboboxChange((event) => {
              value = event.value
              void handle.update()
            }),
          ]}
          name="airport"
          placeholder="Search airports or codes"
        >
          {airportOptions.map((airport) => (
            <ComboboxOption
              key={airport.value}
              disabled={airport.disabled}
              label={airport.label}
              searchValue={airport.searchValue}
              value={airport.value}
            />
          ))}
        </Combobox>

        <div mix={helpCss}>
          Try typing `san`, `wash`, or airport codes like `ord`, `lax`, or `jfk`, then use ArrowDown
          and Enter.
        </div>
      </div>

      <p mix={valueCss}>{`value=${value ?? 'null'}`}</p>
    </div>
  )
}

let stackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  width: '100%',
})

let fieldCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let labelCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

let helpCss = css({
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let valueCss = css({
  margin: 0,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
})
