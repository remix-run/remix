export type AirportOption = {
  disabled?: boolean
  label: string
  searchValue: string[]
  value: string
}

export let airportOptions: AirportOption[] = [
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
