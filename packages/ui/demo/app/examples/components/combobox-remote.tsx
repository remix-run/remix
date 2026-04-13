import { css, on, type Handle } from 'remix/component'
import { Combobox, ComboboxOption, Glyph, theme, ui } from 'remix/ui'

type AirportOption = {
  label: string
  searchValue: string[]
  value: string
}

export default function Example(handle: Handle) {
  let airports: AirportOption[] = []
  let loading = false

  return () => (
    <div mix={[ui.row, ui.gap.sm]}>
      <Combobox
        mix={[
          css({ width: '16rem' }),
          on('input', async (event, signal) => {
            let target = event.target as HTMLInputElement
            loading = true
            handle.update()
            let response = await fetch(`/api/airports?q=${target.value}`, { signal })
            let data = await response.json()
            airports = data.airports.slice(0, 10)
            loading = false
            handle.update()
          }),
        ]}
        name="airport"
        placeholder="Search airports or codes"
      >
        {airports.map((airport) => (
          <ComboboxOption
            key={airport.value}
            label={airport.label}
            searchValue={airport.searchValue}
            value={airport.value}
          />
        ))}
      </Combobox>
      <Glyph
        name={loading ? 'spinner' : 'search'}
        mix={[ui.icon.lg, css({ marginLeft: '-2rem' }), loading && ui.animation.spin()]}
      />
    </div>
  )
}
