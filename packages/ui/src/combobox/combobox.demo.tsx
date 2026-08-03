import { css, type Handle } from '@remix-run/ui'
import { Combobox, ComboboxOption } from '@remix-run/ui/combobox'
import { onComboboxChange } from '@remix-run/ui/combobox/primitives'

/**
 * @name Combobox Overview
 * @description A searchable combobox with keyboard navigation. Try typing airport names or codes like ord, lax, or jfk.
 * @layout center
 */
export default function Example(handle: Handle) {
  let value: string | null = null

  return () => (
    <div mix={stackCss}>
      <div mix={fieldCss}>
        <label for="airport-combobox" mix={labelCss}>
          Airport
        </label>

        <Combobox
          inputId="airport-combobox"
          mix={[
            comboboxCss,
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

type AirportOption = {
  disabled?: boolean
  label: string
  searchValue: string[]
  value: string
}

const airportOptions: AirportOption[] = [
  {
    label: 'Hartsfield-Jackson Atlanta International',
    searchValue: ['atl', 'atlanta', 'hartsfield-jackson atlanta international'],
    value: 'ATL',
  },
  {
    label: 'Austin-Bergstrom International',
    searchValue: ['aus', 'austin', 'austin-bergstrom international'],
    value: 'AUS',
  },
  {
    label: 'Boston Logan International',
    searchValue: ['bos', 'boston', 'boston logan international'],
    value: 'BOS',
  },
  {
    label: 'Baltimore/Washington International',
    searchValue: ['bwi', 'baltimore', 'washington', 'baltimore/washington international'],
    value: 'BWI',
  },
  {
    label: 'Ronald Reagan Washington National',
    searchValue: ['dca', 'reagan', 'washington', 'ronald reagan washington national'],
    value: 'DCA',
  },
  {
    label: 'Denver International',
    searchValue: ['den', 'denver', 'denver international'],
    value: 'DEN',
  },
  {
    label: 'Dallas/Fort Worth International',
    searchValue: ['dfw', 'dallas', 'fort worth', 'dallas/fort worth international'],
    value: 'DFW',
  },
  {
    label: 'Newark Liberty International',
    searchValue: ['ewr', 'newark', 'newark liberty international'],
    value: 'EWR',
  },
  {
    label: 'Daniel K. Inouye International',
    searchValue: ['hnl', 'honolulu', 'daniel k. inouye international'],
    value: 'HNL',
  },
  {
    label: 'Washington Dulles International',
    searchValue: ['iad', 'dulles', 'washington', 'washington dulles international'],
    value: 'IAD',
  },
  {
    label: 'John F. Kennedy International',
    searchValue: ['jfk', 'kennedy', 'new york', 'john f. kennedy international'],
    value: 'JFK',
  },
  {
    label: 'Harry Reid International',
    searchValue: ['las', 'las vegas', 'harry reid international'],
    value: 'LAS',
  },
  {
    label: 'Los Angeles International',
    searchValue: ['lax', 'los angeles', 'los angeles international'],
    value: 'LAX',
  },
  {
    label: 'Orlando International',
    searchValue: ['mco', 'orlando', 'orlando international'],
    value: 'MCO',
  },
  {
    label: 'Miami International',
    searchValue: ['mia', 'miami', 'miami international'],
    value: 'MIA',
  },
  {
    label: "Chicago O'Hare International",
    searchValue: ['ord', 'ohare', 'chicago', "chicago o'hare international"],
    value: 'ORD',
  },
  {
    label: 'Portland International',
    searchValue: ['pdx', 'portland', 'portland international'],
    value: 'PDX',
  },
  {
    label: 'San Diego International',
    searchValue: ['san', 'san diego', 'san diego international'],
    value: 'SAN',
  },
  {
    label: 'San Francisco International',
    searchValue: ['sfo', 'san francisco', 'san francisco international'],
    value: 'SFO',
  },
  {
    disabled: true,
    label: 'San Jose Mineta International',
    searchValue: ['sjc', 'san jose', 'san jose mineta international'],
    value: 'SJC',
  },
]

const comboboxCss = css({
  width: '16rem',
})

const stackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  width: '100%',
})

const fieldCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
})

const labelCss = css({
  margin: 0,
  fontSize: '12px',
  fontWeight: '600',
  color: 'light-dark(#151515, #ececec)',
})

const helpCss = css({
  fontSize: '12px',
  lineHeight: '1.65',
  color: 'light-dark(#4f4f4f, #b3b3b3)',
})

const valueCss = css({
  margin: 0,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: '12px',
  color: 'light-dark(#4f4f4f, #b3b3b3)',
})
