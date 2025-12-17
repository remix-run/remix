import { on } from '@remix-run/interaction'

document.addEventListener('DOMContentLoaded', async () => {
  let stateSelect = document.querySelector('select[name="state"]') as HTMLSelectElement
  let citySelect = document.querySelector('select[name="city"]') as HTMLSelectElement
  let firstOption = citySelect.querySelector('option') as HTMLOptionElement

  let states = await fakeFetchStates()
  states.forEach((state) => {
    let option = document.createElement('option')
    option.value = state
    option.textContent = state
    stateSelect.appendChild(option)
  })
  stateSelect.disabled = false

  on(stateSelect, {
    async change(event, signal) {
      let state = event.currentTarget.value
      if (!isValidState(state)) throw new Error(`Invalid state: ${state}`)

      firstOption.textContent = 'Loading...'
      citySelect.disabled = true
      citySelect.innerHTML = ''
      citySelect.appendChild(firstOption)

      let cities = await fakeFetchCities(state)
      if (signal.aborted) return

      cities.forEach((city) => {
        let option = document.createElement('option')
        option.value = city
        option.textContent = city
        citySelect.appendChild(option)
      })

      firstOption.remove()
      citySelect.disabled = false
    },
  })
})

async function fakeFetchStates() {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return states
}

async function fakeFetchCities(state: keyof typeof cities) {
  await new Promise((resolve) => setTimeout(resolve, 300 * state.length))
  return cities[state]
}

function isValidState(state: string): state is keyof typeof cities {
  return state in cities
}

let states = [
  'alabama',
  'alaska',
  'arizona',
  'arkansas',
  'california',
  'colorado',
  'connecticut',
  'delaware',
  'florida',
  'georgia',
  'hawaii',
  'idaho',
  'illinois',
  'indiana',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'maine',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'montana',
  'nebraska',
  'nevada',
  'new hampshire',
  'new jersey',
  'new mexico',
  'new york',
  'north carolina',
  'north dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode island',
  'south carolina',
  'south dakota',
  'tennessee',
  'texas',
  'utah',
  'vermont',
  'virginia',
  'washington',
  'west virginia',
  'wisconsin',
  'wyoming',
]

let cities = {
  alabama: [
    'birmingham',
    'montgomery',
    'mobile',
    'huntsville',
    'alabama shores',
    'dothan',
    'gadsden',
    'tuscaloosa',
    'decatur',
  ],
  alaska: [
    'anchorage',
    'fairbanks',
    'juneau',
    'ketchikan',
    'lorena',
    'nunapitchuk',
    'palmer',
    'princeton',
    'wrangell',
  ],
  arizona: [
    'phoenix',
    'tucson',
    'mesa',
    'gilbert',
    'chandler',
    'glendale',
    'scottsdale',
    'tempe',
    'surprise',
  ],
  arkansas: [
    'little rock',
    'fort smith',
    'springdale',
    'fayetteville',
    'rode',
    'conway',
    'paragould',
  ],
  california: [
    'los angeles',
    'san diego',
    'san francisco',
    'san jose',
    'san bernardino',
    'long beach',
    'fresno',
    'sacramento',
    'oakland',
  ],
  colorado: [
    'denver',
    'colorado springs',
    'boulder',
    'fort collins',
    'lafayette',
    'westminster',
    'longmont',
    'broomfield',
  ],
  connecticut: [
    'hartford',
    'new haven',
    'bridgeport',
    'stamford',
    'waterbury',
    'new britain',
    'milford',
    'danbury',
  ],
  delaware: ['wilmington', 'dover', 'newark', 'milford', 'georgetown', 'middletown', 'pike creek'],
  florida: [
    'miami',
    'orlando',
    'tampa',
    'jacksonville',
    'st. petersburg',
    'clearwater',
    'tallahassee',
    'gainesville',
  ],
  georgia: [
    'atlanta',
    'macon',
    'savannah',
    'columbus',
    'albany',
    'augusta',
    'rome',
    'valdosta',
    'waycross',
  ],
  hawaii: ['honolulu', 'waikiki', 'haleiwa', 'kailua', 'kaneohe'],
  idaho: ['boise', 'meridian', 'nampa', 'idaho falls', 'twin falls', 'moscow'],
  illinois: ['chicago', 'springfield', 'rockford', 'naperville', 'joliet', 'peoria', 'urbana'],
  indiana: ['indianapolis', 'fort wayne', 'bloomington', 'lafayette', 'south bend', 'terre haute'],
  iowa: ['des moines', 'cedar rapids', 'iowa city', 'cedar falls', 'dubuque', 'waterloo'],
  kansas: ['topeka', 'kansas city', 'lawrence', 'overland park', 'wichita'],
  kentucky: ['louisville', 'lexington', 'frankfort', 'bowling green', 'richmond', 'owensboro'],
  louisiana: ['new orleans', 'baton rouge', 'shreveport', 'lafayette', 'metairie', 'bossier city'],
  maine: ['portland', 'lewiston', 'south portland', 'biddeford', 'auburn', 'augusta', 'bangor'],
  maryland: [
    'annapolis',
    'frederick',
    'gaithersburg',
    'rockville',
    'towson',
    'baltimore',
    'college park',
  ],
  massachusetts: ['boston', 'cambridge', 'worcester', 'springfield', 'lowell', 'quincy', 'newton'],
  michigan: ['detroit', 'grand rapids', 'ann arbor', 'kalamazoo', 'warren', 'lansing', 'flint'],
  minnesota: ['minneapolis', 'st. paul', 'duluth', 'bloomington', 'rochester', 'burnsville'],
  mississippi: ['jackson', 'biloxi', 'gulfport', 'havana', 'meridian', 'natchez'],
  missouri: [
    'jefferson city',
    'springfield',
    'independence',
    'kirksville',
    'st. louis',
    'kansas city',
  ],
  montana: ['helena', 'billings', 'missoula', 'great falls', 'kalispell', 'bozeman'],
  nebraska: ['lincoln', 'omaha', 'grand island', 'bellevue', 'kearney'],
  nevada: [
    'las vegas',
    'henderson',
    'north las vegas',
    'sun valley',
    'sunrise manor',
    'carson city',
  ],
  'new hampshire': ['concord', 'keene', 'portsmouth', 'manchester', 'nashua'],
  'new jersey': ['trenton', 'newark', 'jersey city', 'paterson', 'elizabeth', 'edison', 'camden'],
  'new mexico': ['santa fe', 'albuquerque', 'las cruces', 'roswell', 'farmington', 'clovis'],
  'new york': ['new york city', 'albany', 'buffalo', 'rochester', 'yonkers', 'syracuse', 'utica'],
  'north carolina': [
    'raleigh',
    'charlotte',
    'greensboro',
    'durham',
    'winston-salem',
    'fayetteville',
    'cary',
  ],
  'north dakota': ['bismarck', 'fargo', 'grand forks', 'minot', 'west fargo', 'williston'],
  ohio: ['columbus', 'cleveland', 'cincinnati', 'toledo', 'akron', 'dayton', 'canton'],
  oklahoma: ['oklahoma city', 'tulsa', 'norman', 'broken arrow', 'lawton', 'edmond'],
  oregon: ['salem', 'portland', 'eugene', 'gresham', 'hillsboro', 'bend', 'medford'],
  pennsylvania: [
    'harrisburg',
    'philadelphia',
    'pittsburgh',
    'allentown',
    'erie',
    'reading',
    'scranton',
  ],
  'rhode island': [
    'providence',
    'warwick',
    'cranston',
    'pawtucket',
    'east providence',
    'woonsocket',
  ],
  'south carolina': [
    'columbia',
    'charleston',
    'north charleston',
    'mount pleasant',
    'rock hill',
    'greenville',
  ],
  'south dakota': ['pierre', 'sioux falls', 'rapid city', 'aberdeen', 'brookings', 'watertown'],
  tennessee: ['nashville', 'memphis', 'knoxville', 'chattanooga', 'clarksville', 'murfreesboro'],
  texas: ['austin', 'houston', 'dallas', 'san antonio', 'fort worth', 'el paso', 'arlington'],
  utah: ['salt lake city', 'west valley city', 'provo', 'west jordan', 'orem', 'sandy'],
  vermont: ['montpelier', 'burlington', 'essex', 'south burlington', 'colchester', 'rutland'],
  virginia: ['richmond', 'virginia beach', 'norfolk', 'chesapeake', 'newport news', 'alexandria'],
  washington: ['olympia', 'seattle', 'spokane', 'tacoma', 'vancouver', 'bellevue', 'everett'],
  'west virginia': [
    'charleston',
    'huntington',
    'morgantown',
    'parkersburg',
    'wheeling',
    'martinsburg',
  ],
  wisconsin: ['madison', 'milwaukee', 'green bay', 'kenosha', 'racine', 'appleton'],
  wyoming: ['cheyenne', 'casper', 'laramie', 'gillette', 'rock springs', 'sheridan'],
}
