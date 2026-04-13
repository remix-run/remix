type AirportSeed = readonly [
  code: string,
  name: string,
  city: string,
  region: string,
  country: string,
  ...aliases: string[],
]

export type AirportRecord = {
  city: string
  code: string
  country: string
  hint: string
  label: string
  region: string | null
  searchValue: string[]
  value: string
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function tokenizeSearchValues(values: string[]) {
  let tokens: string[] = []

  for (let value of values) {
    let normalized = normalizeSearchValue(value)
    if (!normalized) {
      continue
    }

    tokens.push(...normalized.split(/[^a-z0-9]+/).filter((token) => token.length >= 2))
  }

  return tokens
}

function uniqueSearchValues(values: string[]) {
  let seen = new Set<string>()
  let normalizedValues: string[] = []

  for (let value of values) {
    let normalized = normalizeSearchValue(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    normalizedValues.push(normalized)
  }

  return normalizedValues
}

function createAirport([code, name, city, region, country, ...aliases]: AirportSeed): AirportRecord {
  let hintParts = [city]
  if (region) {
    hintParts.push(region)
  }
  if (country) {
    hintParts.push(country)
  }

  return {
    city,
    code,
    country,
    hint: hintParts.join(', '),
    label: name,
    region: region || null,
    searchValue: uniqueSearchValues([
      code,
      name,
      city,
      region,
      country,
      `${city} ${region}`.trim(),
      `${city} ${country}`.trim(),
      ...aliases,
      ...tokenizeSearchValues([name, city, ...aliases]),
    ]),
    value: code,
  }
}

let AIRPORT_SEEDS: AirportSeed[] = [
  // United States
  ['ABQ', 'Albuquerque International Sunport', 'Albuquerque', 'New Mexico', 'United States', 'sunport'],
  ['ANC', 'Ted Stevens Anchorage International', 'Anchorage', 'Alaska', 'United States', 'anchorage'],
  ['ATL', 'Hartsfield-Jackson Atlanta International', 'Atlanta', 'Georgia', 'United States'],
  ['AUS', 'Austin-Bergstrom International', 'Austin', 'Texas', 'United States'],
  ['BDL', 'Bradley International', 'Hartford', 'Connecticut', 'United States', 'bradley'],
  ['BNA', 'Nashville International', 'Nashville', 'Tennessee', 'United States'],
  ['BOI', 'Boise', 'Boise', 'Idaho', 'United States'],
  ['BOS', 'Boston Logan International', 'Boston', 'Massachusetts', 'United States', 'logan'],
  ['BUF', 'Buffalo Niagara International', 'Buffalo', 'New York', 'United States', 'niagara'],
  ['BUR', 'Hollywood Burbank', 'Burbank', 'California', 'United States', 'burbank'],
  ['BWI', 'Baltimore/Washington International', 'Baltimore', 'Maryland', 'United States'],
  ['CHS', 'Charleston International', 'Charleston', 'South Carolina', 'United States'],
  ['CLE', 'Cleveland Hopkins International', 'Cleveland', 'Ohio', 'United States', 'hopkins'],
  ['CLT', 'Charlotte Douglas International', 'Charlotte', 'North Carolina', 'United States', 'douglas'],
  ['CMH', 'John Glenn Columbus International', 'Columbus', 'Ohio', 'United States', 'john glenn'],
  ['CVG', 'Cincinnati/Northern Kentucky International', 'Cincinnati', 'Kentucky', 'United States'],
  ['DAL', 'Dallas Love Field', 'Dallas', 'Texas', 'United States', 'love field'],
  ['DCA', 'Ronald Reagan Washington National', 'Washington', 'District of Columbia', 'United States', 'reagan'],
  ['DEN', 'Denver International', 'Denver', 'Colorado', 'United States'],
  ['DFW', 'Dallas/Fort Worth International', 'Dallas', 'Texas', 'United States', 'fort worth'],
  ['DTW', 'Detroit Metropolitan Wayne County', 'Detroit', 'Michigan', 'United States', 'metro'],
  ['EWR', 'Newark Liberty International', 'Newark', 'New Jersey', 'United States', 'liberty'],
  ['FLL', 'Fort Lauderdale-Hollywood International', 'Fort Lauderdale', 'Florida', 'United States', 'hollywood'],
  ['GEG', 'Spokane International', 'Spokane', 'Washington', 'United States'],
  ['HNL', 'Daniel K. Inouye International', 'Honolulu', 'Hawaii', 'United States', 'honolulu'],
  ['HOU', 'William P. Hobby', 'Houston', 'Texas', 'United States', 'hobby'],
  ['IAD', 'Washington Dulles International', 'Washington', 'Virginia', 'United States', 'dulles'],
  ['IAH', 'George Bush Intercontinental', 'Houston', 'Texas', 'United States', 'intercontinental'],
  ['IND', 'Indianapolis International', 'Indianapolis', 'Indiana', 'United States'],
  ['JAX', 'Jacksonville International', 'Jacksonville', 'Florida', 'United States'],
  ['JFK', 'John F. Kennedy International', 'New York', 'New York', 'United States', 'kennedy'],
  [
    'KOA',
    'Ellison Onizuka Kona International at Keahole',
    'Kona',
    'Hawaii',
    'United States',
    'keahole',
  ],
  ['LAS', 'Harry Reid International', 'Las Vegas', 'Nevada', 'United States', 'mccarran'],
  ['LAX', 'Los Angeles International', 'Los Angeles', 'California', 'United States'],
  ['LIH', 'Lihue', 'Lihue', 'Hawaii', 'United States', 'kauai'],
  ['MCI', 'Kansas City International', 'Kansas City', 'Missouri', 'United States'],
  ['MCO', 'Orlando International', 'Orlando', 'Florida', 'United States'],
  ['MDW', 'Chicago Midway International', 'Chicago', 'Illinois', 'United States', 'midway'],
  ['MEM', 'Memphis International', 'Memphis', 'Tennessee', 'United States'],
  ['MHT', 'Manchester-Boston Regional', 'Manchester', 'New Hampshire', 'United States'],
  ['MIA', 'Miami International', 'Miami', 'Florida', 'United States'],
  ['MKE', 'Milwaukee Mitchell International', 'Milwaukee', 'Wisconsin', 'United States', 'mitchell'],
  ['MSP', 'Minneapolis-Saint Paul International', 'Minneapolis', 'Minnesota', 'United States', 'twin cities'],
  [
    'MSY',
    'Louis Armstrong New Orleans International',
    'New Orleans',
    'Louisiana',
    'United States',
    'armstrong',
  ],
  ['OAK', 'Oakland International', 'Oakland', 'California', 'United States'],
  ['OGG', 'Kahului', 'Kahului', 'Hawaii', 'United States', 'maui'],
  ['OKC', 'Will Rogers World', 'Oklahoma City', 'Oklahoma', 'United States', 'will rogers'],
  ['OMA', 'Eppley Airfield', 'Omaha', 'Nebraska', 'United States', 'eppley'],
  ['ONT', 'Ontario International', 'Ontario', 'California', 'United States'],
  ['ORF', 'Norfolk International', 'Norfolk', 'Virginia', 'United States'],
  ['ORD', "Chicago O'Hare International", 'Chicago', 'Illinois', 'United States', 'ohare'],
  ['PBI', 'Palm Beach International', 'West Palm Beach', 'Florida', 'United States', 'palm beach'],
  ['PDX', 'Portland International', 'Portland', 'Oregon', 'United States'],
  ['PHL', 'Philadelphia International', 'Philadelphia', 'Pennsylvania', 'United States'],
  ['PHX', 'Phoenix Sky Harbor International', 'Phoenix', 'Arizona', 'United States', 'sky harbor'],
  ['PIT', 'Pittsburgh International', 'Pittsburgh', 'Pennsylvania', 'United States'],
  ['PWM', 'Portland International Jetport', 'Portland', 'Maine', 'United States', 'jetport'],
  ['RDU', 'Raleigh-Durham International', 'Raleigh', 'North Carolina', 'United States', 'durham'],
  ['RIC', 'Richmond International', 'Richmond', 'Virginia', 'United States'],
  ['RNO', 'Reno-Tahoe International', 'Reno', 'Nevada', 'United States', 'tahoe'],
  ['ROC', 'Frederick Douglass Greater Rochester International', 'Rochester', 'New York', 'United States'],
  ['RSW', 'Southwest Florida International', 'Fort Myers', 'Florida', 'United States', 'fort myers'],
  ['SAN', 'San Diego International', 'San Diego', 'California', 'United States', 'lindbergh'],
  ['SAT', 'San Antonio International', 'San Antonio', 'Texas', 'United States'],
  ['SAV', 'Savannah/Hilton Head International', 'Savannah', 'Georgia', 'United States', 'hilton head'],
  ['SEA', 'Seattle-Tacoma International', 'Seattle', 'Washington', 'United States', 'seatac'],
  ['SFO', 'San Francisco International', 'San Francisco', 'California', 'United States'],
  ['SJC', 'Norman Y. Mineta San Jose International', 'San Jose', 'California', 'United States', 'mineta'],
  ['SLC', 'Salt Lake City International', 'Salt Lake City', 'Utah', 'United States'],
  ['SMF', 'Sacramento International', 'Sacramento', 'California', 'United States'],
  ['SNA', 'John Wayne', 'Orange County', 'California', 'United States', 'santa ana'],
  ['STL', 'St. Louis Lambert International', 'St. Louis', 'Missouri', 'United States', 'lambert'],
  ['SYR', 'Syracuse Hancock International', 'Syracuse', 'New York', 'United States', 'hancock'],
  ['TPA', 'Tampa International', 'Tampa', 'Florida', 'United States'],
  ['TUS', 'Tucson International', 'Tucson', 'Arizona', 'United States'],

  // Canada
  ['YEG', 'Edmonton International', 'Edmonton', 'Alberta', 'Canada'],
  ['YHZ', 'Halifax Stanfield International', 'Halifax', 'Nova Scotia', 'Canada', 'stanfield'],
  ['YOW', 'Ottawa International', 'Ottawa', 'Ontario', 'Canada', 'macdonald-cartier'],
  ['YQB', 'Quebec City Jean Lesage International', 'Quebec City', 'Quebec', 'Canada', 'jean lesage'],
  ['YQR', 'Regina International', 'Regina', 'Saskatchewan', 'Canada'],
  ['YQT', 'Thunder Bay International', 'Thunder Bay', 'Ontario', 'Canada'],
  ['YUL', 'Montreal-Trudeau International', 'Montreal', 'Quebec', 'Canada', 'trudeau'],
  ['YVR', 'Vancouver International', 'Vancouver', 'British Columbia', 'Canada'],
  [
    'YWG',
    'Winnipeg James Armstrong Richardson International',
    'Winnipeg',
    'Manitoba',
    'Canada',
    'richardson',
  ],
  ['YXE', 'Saskatoon John G. Diefenbaker International', 'Saskatoon', 'Saskatchewan', 'Canada', 'diefenbaker'],
  ['YYC', 'Calgary International', 'Calgary', 'Alberta', 'Canada'],
  ['YYJ', 'Victoria International', 'Victoria', 'British Columbia', 'Canada'],
  ["YYT", "St. John's International", "St. John's", 'Newfoundland and Labrador', 'Canada'],
  ['YYZ', 'Toronto Pearson International', 'Toronto', 'Ontario', 'Canada', 'pearson'],

  // Mexico, Central America, and the Caribbean
  ['AUA', 'Queen Beatrix International', 'Oranjestad', 'Aruba', 'Aruba', 'beatrix'],
  ['BJX', 'Del Bajio International', 'Leon', 'Guanajuato', 'Mexico', 'guanajuato'],
  ['BZE', 'Philip S. W. Goldson International', 'Belize City', 'Belize', 'Belize', 'goldson'],
  ['CUN', 'Cancun International', 'Cancun', 'Quintana Roo', 'Mexico'],
  ['CUR', 'Curacao International', 'Willemstad', 'Curacao', 'Curacao', 'hato'],
  ['GDL', 'Guadalajara International', 'Guadalajara', 'Jalisco', 'Mexico', 'miguel hidalgo'],
  ['GUA', 'La Aurora International', 'Guatemala City', 'Guatemala', 'Guatemala', 'la aurora'],
  ['HAV', 'Jose Marti International', 'Havana', 'Havana', 'Cuba', 'jose marti'],
  ['KIN', 'Norman Manley International', 'Kingston', 'Kingston', 'Jamaica', 'norman manley'],
  ['LIR', 'Daniel Oduber Quiros International', 'Liberia', 'Guanacaste', 'Costa Rica'],
  ['MBJ', 'Sangster International', 'Montego Bay', 'Saint James', 'Jamaica', 'sangster'],
  ['MEX', 'Mexico City International', 'Mexico City', 'Mexico City', 'Mexico', 'benito juarez'],
  ['MGA', 'Augusto C. Sandino International', 'Managua', 'Managua', 'Nicaragua', 'sandino'],
  ['MTY', 'Monterrey International', 'Monterrey', 'Nuevo Leon', 'Mexico', 'mariano escobedo'],
  ['NAS', 'Lynden Pindling International', 'Nassau', 'New Providence', 'Bahamas', 'pindling'],
  ['PTY', 'Tocumen International', 'Panama City', 'Panama', 'Panama', 'tocumen'],
  ['PUJ', 'Punta Cana International', 'Punta Cana', 'La Altagracia', 'Dominican Republic'],
  ['PVR', 'Puerto Vallarta International', 'Puerto Vallarta', 'Jalisco', 'Mexico'],
  ['SAL', 'El Salvador International', 'San Salvador', 'La Paz', 'El Salvador', 'monsenor romero'],
  ['SAP', 'Ramon Villeda Morales International', 'San Pedro Sula', 'Cortes', 'Honduras'],
  ['SDQ', 'Las Americas International', 'Santo Domingo', 'Santo Domingo', 'Dominican Republic'],
  ['SJD', 'Los Cabos International', 'San Jose del Cabo', 'Baja California Sur', 'Mexico', 'cabo'],
  ['SJO', 'Juan Santamaria International', 'San Jose', 'San Jose', 'Costa Rica', 'santamaria'],
  ['SJU', 'Luis Munoz Marin International', 'San Juan', 'Puerto Rico', 'United States', 'munoz marin'],
  ['STI', 'Cibao International', 'Santiago de los Caballeros', 'Santiago', 'Dominican Republic', 'cibao'],
  ['TGU', 'Toncontin International', 'Tegucigalpa', 'Francisco Morazan', 'Honduras', 'toncontin'],
  ['TIJ', 'Tijuana International', 'Tijuana', 'Baja California', 'Mexico'],
  ['VRA', 'Juan Gualberto Gomez', 'Varadero', 'Matanzas', 'Cuba'],

  // South America
  ['AEP', 'Aeroparque Jorge Newbery', 'Buenos Aires', 'Buenos Aires', 'Argentina', 'aeroparque'],
  ['ASU', 'Silvio Pettirossi International', 'Asuncion', 'Central', 'Paraguay', 'pettirossi'],
  ['BOG', 'El Dorado International', 'Bogota', 'Bogota', 'Colombia', 'el dorado'],
  ['BSB', 'Brasilia International', 'Brasilia', 'Federal District', 'Brazil', 'juscelino kubitschek'],
  ['CCS', 'Simon Bolivar International', 'Caracas', 'La Guaira', 'Venezuela', 'maiquetia'],
  ['CGH', 'Sao Paulo/Congonhas', 'Sao Paulo', 'Sao Paulo', 'Brazil', 'congonhas'],
  ['CNF', 'Belo Horizonte/Confins International', 'Belo Horizonte', 'Minas Gerais', 'Brazil', 'confins'],
  ['COR', 'Ingeniero Aeronautico Ambrosio Taravella', 'Cordoba', 'Cordoba', 'Argentina'],
  ['CTG', 'Rafael Nunez International', 'Cartagena', 'Bolivar', 'Colombia', 'rafael nunez'],
  ['CUZ', 'Alejandro Velasco Astete', 'Cusco', 'Cusco', 'Peru'],
  ['CWB', 'Afonso Pena International', 'Curitiba', 'Parana', 'Brazil', 'afonso pena'],
  ['EZE', 'Ministro Pistarini International', 'Buenos Aires', 'Buenos Aires', 'Argentina', 'ezeiza'],
  ['FOR', 'Fortaleza International', 'Fortaleza', 'Ceara', 'Brazil', 'pinto martins'],
  ['GIG', 'Rio de Janeiro/Galeao International', 'Rio de Janeiro', 'Rio de Janeiro', 'Brazil', 'galeao'],
  ['GRU', 'Sao Paulo/Guarulhos International', 'Sao Paulo', 'Sao Paulo', 'Brazil', 'guarulhos'],
  ['GYE', 'Jose Joaquin de Olmedo International', 'Guayaquil', 'Guayas', 'Ecuador', 'olmedo'],
  ['LIM', 'Jorge Chavez International', 'Lima', 'Lima', 'Peru', 'jorge chavez'],
  ['LPB', 'El Alto International', 'La Paz', 'La Paz', 'Bolivia', 'el alto'],
  ['MAO', 'Eduardo Gomes International', 'Manaus', 'Amazonas', 'Brazil', 'eduardo gomes'],
  ['MDE', 'Jose Maria Cordova International', 'Medellin', 'Antioquia', 'Colombia', 'cordova'],
  ['MDZ', 'El Plumerillo', 'Mendoza', 'Mendoza', 'Argentina'],
  ['MVD', 'Carrasco International', 'Montevideo', 'Canelones', 'Uruguay', 'carrasco'],
  ['POA', 'Salgado Filho International', 'Porto Alegre', 'Rio Grande do Sul', 'Brazil', 'salgado filho'],
  ['REC', 'Recife/Guararapes International', 'Recife', 'Pernambuco', 'Brazil', 'guararapes'],
  ['SCL', 'Arturo Merino Benitez International', 'Santiago', 'Santiago Metropolitan', 'Chile'],
  ['SDU', 'Santos Dumont', 'Rio de Janeiro', 'Rio de Janeiro', 'Brazil'],
  ['SSA', 'Salvador International', 'Salvador', 'Bahia', 'Brazil', 'deputado luis eduardo magalhaes'],
  ['UIO', 'Mariscal Sucre International', 'Quito', 'Pichincha', 'Ecuador', 'mariscal sucre'],
  ['VVI', 'Viru Viru International', 'Santa Cruz de la Sierra', 'Santa Cruz', 'Bolivia', 'viru viru'],

  // Europe
  ['AAR', 'Aarhus', 'Aarhus', 'Central Denmark', 'Denmark'],
  ['ADB', 'Izmir Adnan Menderes', 'Izmir', 'Izmir', 'Turkey', 'adnan menderes'],
  ['AGP', 'Malaga-Costa del Sol', 'Malaga', 'Andalusia', 'Spain'],
  ['AMS', 'Amsterdam Schiphol', 'Amsterdam', 'North Holland', 'Netherlands', 'schiphol'],
  ['ARN', 'Stockholm Arlanda', 'Stockholm', 'Stockholm County', 'Sweden', 'arlanda'],
  ['ATH', 'Athens International', 'Athens', 'Attica', 'Greece', 'eleftherios venizelos'],
  ['AYT', 'Antalya', 'Antalya', 'Antalya', 'Turkey'],
  ['BCN', 'Barcelona-El Prat', 'Barcelona', 'Catalonia', 'Spain', 'el prat'],
  ['BEG', 'Belgrade Nikola Tesla', 'Belgrade', 'Belgrade', 'Serbia', 'nikola tesla'],
  ['BER', 'Berlin Brandenburg', 'Berlin', 'Berlin', 'Germany'],
  ['BFS', 'Belfast International', 'Belfast', 'Northern Ireland', 'United Kingdom'],
  ['BGO', 'Bergen', 'Bergen', 'Vestland', 'Norway'],
  ['BLQ', 'Bologna Guglielmo Marconi', 'Bologna', 'Emilia-Romagna', 'Italy', 'marconi'],
  ['BRU', 'Brussels', 'Brussels', 'Brussels-Capital', 'Belgium'],
  ['BSL', 'EuroAirport Basel Mulhouse Freiburg', 'Basel', 'Basel-Stadt', 'Switzerland', 'basel'],
  ['BUD', 'Budapest Ferenc Liszt International', 'Budapest', 'Central Hungary', 'Hungary', 'ferenc liszt'],
  ['CDG', 'Charles de Gaulle', 'Paris', 'Ile-de-France', 'France', 'roissy'],
  ['CGN', 'Cologne Bonn', 'Cologne', 'North Rhine-Westphalia', 'Germany', 'koeln'],
  ['CIA', 'Rome Ciampino', 'Rome', 'Lazio', 'Italy', 'ciampino'],
  ['CPH', 'Copenhagen', 'Copenhagen', 'Capital Region', 'Denmark'],
  ['CRL', 'Brussels South Charleroi', 'Charleroi', 'Wallonia', 'Belgium', 'charleroi'],
  ['DUB', 'Dublin', 'Dublin', 'Leinster', 'Ireland'],
  ['DUS', 'Dusseldorf', 'Dusseldorf', 'North Rhine-Westphalia', 'Germany', 'duesseldorf'],
  ['EDI', 'Edinburgh', 'Edinburgh', 'Scotland', 'United Kingdom'],
  ['EIN', 'Eindhoven', 'Eindhoven', 'North Brabant', 'Netherlands'],
  ['ESB', 'Ankara Esenboga', 'Ankara', 'Ankara', 'Turkey', 'esenboga'],
  ['FAO', 'Faro', 'Faro', 'Algarve', 'Portugal'],
  ['FCO', 'Rome Fiumicino', 'Rome', 'Lazio', 'Italy', 'leonardo da vinci'],
  ['FRA', 'Frankfurt', 'Frankfurt', 'Hesse', 'Germany'],
  ['GDN', 'Gdansk Lech Walesa', 'Gdansk', 'Pomeranian', 'Poland', 'lech walesa'],
  ['GLA', 'Glasgow', 'Glasgow', 'Scotland', 'United Kingdom'],
  ['GOT', 'Gothenburg Landvetter', 'Gothenburg', 'Vastra Gotaland', 'Sweden', 'landvetter'],
  ['GVA', 'Geneva', 'Geneva', 'Geneva', 'Switzerland'],
  ['HAM', 'Hamburg', 'Hamburg', 'Hamburg', 'Germany'],
  ['HEL', 'Helsinki', 'Helsinki', 'Uusimaa', 'Finland'],
  ['IST', 'Istanbul', 'Istanbul', 'Istanbul', 'Turkey', 'istanbul airport'],
  ['KEF', 'Keflavik International', 'Reykjavik', 'Southern Peninsula', 'Iceland', 'keflavik'],
  ['KRK', 'John Paul II Krakow-Balice', 'Krakow', 'Lesser Poland', 'Poland', 'balice'],
  ['LCY', 'London City', 'London', 'England', 'United Kingdom'],
  ['LGW', 'Gatwick', 'London', 'England', 'United Kingdom'],
  ['LHR', 'Heathrow', 'London', 'England', 'United Kingdom'],
  ['LIS', 'Humberto Delgado', 'Lisbon', 'Lisbon', 'Portugal', 'lisbon'],
  ['LJU', 'Ljubljana Joze Pucnik', 'Ljubljana', 'Central Slovenia', 'Slovenia', 'joze pucnik'],
  ['LIN', 'Milan Linate', 'Milan', 'Lombardy', 'Italy', 'linate'],
  ['LTN', 'London Luton', 'Luton', 'England', 'United Kingdom'],
  ['LYS', 'Lyon-Saint Exupery', 'Lyon', 'Auvergne-Rhone-Alpes', 'France', 'saint exupery'],
  ['MAD', 'Adolfo Suarez Madrid-Barajas', 'Madrid', 'Community of Madrid', 'Spain', 'barajas'],
  ['MAN', 'Manchester', 'Manchester', 'England', 'United Kingdom'],
  ['MRS', 'Marseille Provence', 'Marseille', 'Provence-Alpes-Cote d Azur', 'France', 'marseille'],
  ['MUC', 'Munich', 'Munich', 'Bavaria', 'Germany'],
  ['MXP', 'Milan Malpensa', 'Milan', 'Lombardy', 'Italy', 'malpensa'],
  ['NAP', 'Naples', 'Naples', 'Campania', 'Italy', 'napoli'],
  ['NCE', "Nice Cote d'Azur", 'Nice', 'Provence-Alpes-Cote d Azur', 'France', 'nice'],
  ['ORK', 'Cork', 'Cork', 'Munster', 'Ireland'],
  ['ORY', 'Paris Orly', 'Paris', 'Ile-de-France', 'France'],
  ['OSL', 'Oslo Gardermoen', 'Oslo', 'Viken', 'Norway', 'gardermoen'],
  ['OTP', 'Henri Coanda Bucharest', 'Bucharest', 'Bucharest', 'Romania', 'otopeni'],
  ['OPO', 'Porto', 'Porto', 'Porto', 'Portugal'],
  ['PMI', 'Palma de Mallorca', 'Palma', 'Balearic Islands', 'Spain', 'mallorca'],
  ['PRG', 'Vaclav Havel Prague', 'Prague', 'Prague', 'Czech Republic', 'vaclav havel'],
  ['SAW', 'Sabiha Gokcen', 'Istanbul', 'Istanbul', 'Turkey', 'sabiha gokcen'],
  ['SJJ', 'Sarajevo International', 'Sarajevo', 'Sarajevo', 'Bosnia and Herzegovina'],
  ['SKG', 'Thessaloniki', 'Thessaloniki', 'Central Macedonia', 'Greece', 'makedonia'],
  ['SOF', 'Sofia', 'Sofia', 'Sofia City', 'Bulgaria'],
  ['STR', 'Stuttgart', 'Stuttgart', 'Baden-Wurttemberg', 'Germany'],
  ['SVQ', 'Seville', 'Seville', 'Andalusia', 'Spain', 'sevilla'],
  ['SZG', 'Salzburg', 'Salzburg', 'Salzburg', 'Austria'],
  ['TIA', 'Tirana International', 'Tirana', 'Tirana', 'Albania', 'mother teresa'],
  ['TLS', 'Toulouse-Blagnac', 'Toulouse', 'Occitanie', 'France', 'blagnac'],
  ['VCE', 'Venice Marco Polo', 'Venice', 'Veneto', 'Italy', 'marco polo'],
  ['VIE', 'Vienna International', 'Vienna', 'Vienna', 'Austria'],
  ['WAW', 'Warsaw Chopin', 'Warsaw', 'Masovian', 'Poland', 'chopin'],
  ['ZAG', 'Zagreb Franjo Tudman', 'Zagreb', 'Zagreb', 'Croatia', 'franjo tudman'],
  ['ZRH', 'Zurich', 'Zurich', 'Zurich', 'Switzerland'],

  // Middle East and Africa
  ['ABJ', 'Felix Houphouet-Boigny', 'Abidjan', 'Lagunes', 'Ivory Coast'],
  ['ABV', 'Nnamdi Azikiwe International', 'Abuja', 'Federal Capital Territory', 'Nigeria', 'azikiwe'],
  ['ACC', 'Kotoka International', 'Accra', 'Greater Accra', 'Ghana', 'kotoka'],
  ['ADD', 'Bole International', 'Addis Ababa', 'Addis Ababa', 'Ethiopia', 'bole'],
  ['ALG', 'Houari Boumediene', 'Algiers', 'Algiers', 'Algeria', 'boumediene'],
  ['AMM', 'Queen Alia International', 'Amman', 'Amman', 'Jordan', 'queen alia'],
  ['AUH', 'Abu Dhabi International', 'Abu Dhabi', 'Abu Dhabi', 'United Arab Emirates'],
  ['BAH', 'Bahrain International', 'Manama', 'Muharraq', 'Bahrain'],
  ['BEY', 'Beirut-Rafic Hariri International', 'Beirut', 'Beirut', 'Lebanon', 'rafic hariri'],
  ['CAI', 'Cairo International', 'Cairo', 'Cairo', 'Egypt'],
  ['CMN', 'Mohammed V International', 'Casablanca', 'Casablanca-Settat', 'Morocco', 'mohammed v'],
  ['CPT', 'Cape Town International', 'Cape Town', 'Western Cape', 'South Africa'],
  ['DAR', 'Julius Nyerere International', 'Dar es Salaam', 'Dar es Salaam', 'Tanzania', 'nyerere'],
  ['DMM', 'King Fahd International', 'Dammam', 'Eastern Province', 'Saudi Arabia', 'king fahd'],
  ['DOH', 'Hamad International', 'Doha', 'Doha', 'Qatar'],
  ['DUR', 'King Shaka International', 'Durban', 'KwaZulu-Natal', 'South Africa', 'king shaka'],
  ['DWC', 'Al Maktoum International', 'Dubai', 'Dubai', 'United Arab Emirates', 'al maktoum'],
  ['DXB', 'Dubai International', 'Dubai', 'Dubai', 'United Arab Emirates'],
  ['EBB', 'Entebbe International', 'Entebbe', 'Central Region', 'Uganda'],
  ['HRG', 'Hurghada International', 'Hurghada', 'Red Sea', 'Egypt'],
  ['JED', 'King Abdulaziz International', 'Jeddah', 'Makkah', 'Saudi Arabia', 'king abdulaziz'],
  ['JNB', 'O.R. Tambo International', 'Johannesburg', 'Gauteng', 'South Africa', 'ortambo'],
  ['KGL', 'Kigali International', 'Kigali', 'Kigali', 'Rwanda'],
  ['KWI', 'Kuwait International', 'Kuwait City', 'Al Asimah', 'Kuwait'],
  ['LOS', 'Murtala Muhammed International', 'Lagos', 'Lagos', 'Nigeria', 'murtala'],
  ['MCT', 'Muscat International', 'Muscat', 'Muscat', 'Oman'],
  ['MED', 'Prince Mohammad bin Abdulaziz', 'Medina', 'Al Madinah', 'Saudi Arabia'],
  ['MRU', 'Sir Seewoosagur Ramgoolam International', 'Mahebourg', 'Grand Port', 'Mauritius'],
  ['NBO', 'Jomo Kenyatta International', 'Nairobi', 'Nairobi County', 'Kenya', 'jomo kenyatta'],
  ['RAK', 'Marrakesh Menara', 'Marrakesh', 'Marrakesh-Safi', 'Morocco', 'menara'],
  ['RUH', 'King Khalid International', 'Riyadh', 'Riyadh', 'Saudi Arabia', 'king khalid'],
  ['SEZ', 'Seychelles International', 'Mahe', 'Mahe', 'Seychelles'],
  ['SHJ', 'Sharjah International', 'Sharjah', 'Sharjah', 'United Arab Emirates'],
  ['SSH', 'Sharm el-Sheikh International', 'Sharm el-Sheikh', 'South Sinai', 'Egypt'],
  ['TLV', 'Ben Gurion', 'Tel Aviv', 'Central District', 'Israel', 'ben gurion'],
  ['TUN', 'Tunis-Carthage', 'Tunis', 'Tunis', 'Tunisia', 'carthage'],

  // Asia-Pacific
  ['ADL', 'Adelaide', 'Adelaide', 'South Australia', 'Australia'],
  ['AKL', 'Auckland', 'Auckland', 'Auckland', 'New Zealand'],
  ['BKI', 'Kota Kinabalu International', 'Kota Kinabalu', 'Sabah', 'Malaysia'],
  ['BKK', 'Suvarnabhumi', 'Bangkok', 'Bangkok', 'Thailand', 'suvarnabhumi'],
  ['BLR', 'Kempegowda International', 'Bengaluru', 'Karnataka', 'India', 'bangalore'],
  ['BNE', 'Brisbane', 'Brisbane', 'Queensland', 'Australia'],
  ['BOM', 'Chhatrapati Shivaji Maharaj International', 'Mumbai', 'Maharashtra', 'India', 'bombay'],
  ['BWN', 'Brunei International', 'Bandar Seri Begawan', 'Brunei-Muara', 'Brunei'],
  ['CBR', 'Canberra', 'Canberra', 'Australian Capital Territory', 'Australia'],
  ['CEB', 'Mactan-Cebu International', 'Cebu', 'Central Visayas', 'Philippines', 'mactan'],
  ['CGK', 'Soekarno-Hatta International', 'Jakarta', 'Banten', 'Indonesia', 'soekarno-hatta'],
  ['CGP', 'Shah Amanat International', 'Chittagong', 'Chattogram', 'Bangladesh'],
  ['CHC', 'Christchurch', 'Christchurch', 'Canterbury', 'New Zealand'],
  ['CJU', 'Jeju International', 'Jeju City', 'Jeju', 'South Korea'],
  ['CMB', 'Bandaranaike International', 'Colombo', 'Western Province', 'Sri Lanka'],
  ['CAN', 'Guangzhou Baiyun', 'Guangzhou', 'Guangdong', 'China', 'baiyun'],
  ['CNS', 'Cairns', 'Cairns', 'Queensland', 'Australia'],
  ['CNX', 'Chiang Mai International', 'Chiang Mai', 'Chiang Mai', 'Thailand'],
  ['CTU', 'Chengdu Shuangliu', 'Chengdu', 'Sichuan', 'China', 'shuangliu'],
  ['CXR', 'Cam Ranh International', 'Nha Trang', 'Khanh Hoa', 'Vietnam', 'cam ranh'],
  ['DAC', 'Hazrat Shahjalal International', 'Dhaka', 'Dhaka', 'Bangladesh'],
  ['DAD', 'Da Nang International', 'Da Nang', 'Da Nang', 'Vietnam'],
  ['DEL', 'Indira Gandhi International', 'Delhi', 'Delhi', 'India'],
  ['DMK', 'Don Mueang International', 'Bangkok', 'Bangkok', 'Thailand'],
  ['DPS', 'I Gusti Ngurah Rai International', 'Denpasar', 'Bali', 'Indonesia', 'bali'],
  ['DRW', 'Darwin', 'Darwin', 'Northern Territory', 'Australia'],
  ['DVO', 'Francisco Bangoy International', 'Davao', 'Davao Region', 'Philippines', 'bangoy'],
  ['FUK', 'Fukuoka', 'Fukuoka', 'Kyushu', 'Japan'],
  ['GMP', 'Gimpo International', 'Seoul', 'Seoul', 'South Korea', 'gimpo'],
  ['GOI', 'Manohar International', 'Goa', 'Goa', 'India', 'mopa'],
  ['GUM', 'Antonio B. Won Pat International', 'Guam', 'Guam', 'Guam', 'won pat'],
  ['HAN', 'Noi Bai International', 'Hanoi', 'Hanoi', 'Vietnam', 'noi bai'],
  ['HBA', 'Hobart', 'Hobart', 'Tasmania', 'Australia'],
  ['HGH', 'Hangzhou Xiaoshan', 'Hangzhou', 'Zhejiang', 'China', 'xiaoshan'],
  ['HKG', 'Hong Kong International', 'Hong Kong', 'Hong Kong', 'Hong Kong', 'chek lap kok'],
  ['HLP', 'Halim Perdanakusuma', 'Jakarta', 'Jakarta', 'Indonesia', 'halim'],
  ['HND', 'Tokyo Haneda', 'Tokyo', 'Kanto', 'Japan', 'haneda'],
  ['HYD', 'Rajiv Gandhi International', 'Hyderabad', 'Telangana', 'India'],
  ['ICN', 'Incheon International', 'Seoul', 'Incheon', 'South Korea', 'incheon'],
  ['ITM', 'Osaka Itami', 'Osaka', 'Kansai', 'Japan', 'itami'],
  ['KHH', 'Kaohsiung International', 'Kaohsiung', 'Kaohsiung', 'Taiwan'],
  ['KIX', 'Kansai International', 'Osaka', 'Kansai', 'Japan', 'kansai'],
  ['KMG', 'Kunming Changshui', 'Kunming', 'Yunnan', 'China', 'changshui'],
  ['KTM', 'Tribhuvan International', 'Kathmandu', 'Bagmati', 'Nepal'],
  ['KUL', 'Kuala Lumpur International', 'Kuala Lumpur', 'Selangor', 'Malaysia', 'klia'],
  ['MAA', 'Chennai International', 'Chennai', 'Tamil Nadu', 'India'],
  ['MEL', 'Melbourne', 'Melbourne', 'Victoria', 'Australia', 'tullamarine'],
  ['MLE', 'Velana International', 'Male', 'Kaafu', 'Maldives'],
  ['MFM', 'Macau International', 'Macau', 'Macau', 'Macau'],
  ['MNL', 'Ninoy Aquino International', 'Manila', 'Metro Manila', 'Philippines'],
  ['NAN', 'Nadi International', 'Nadi', 'Ba', 'Fiji'],
  ['NGO', 'Chubu Centrair International', 'Nagoya', 'Chubu', 'Japan', 'centrair'],
  ['NKG', 'Nanjing Lukou', 'Nanjing', 'Jiangsu', 'China', 'lukou'],
  ['NRT', 'Narita International', 'Tokyo', 'Chiba', 'Japan', 'narita'],
  ['OKA', 'Naha', 'Okinawa', 'Okinawa', 'Japan'],
  ['OOL', 'Gold Coast', 'Gold Coast', 'Queensland', 'Australia', 'coolangatta'],
  ['PEK', 'Beijing Capital', 'Beijing', 'Beijing', 'China', 'capital'],
  ['PEN', 'Penang International', 'Penang', 'Penang', 'Malaysia'],
  ['PER', 'Perth', 'Perth', 'Western Australia', 'Australia'],
  ['PKX', 'Beijing Daxing', 'Beijing', 'Beijing', 'China', 'daxing'],
  ['PNH', 'Phnom Penh International', 'Phnom Penh', 'Phnom Penh', 'Cambodia'],
  ['PNQ', 'Pune', 'Pune', 'Maharashtra', 'India'],
  ['PPT', 'Faaa International', 'Papeete', 'Tahiti', 'French Polynesia', 'tahiti'],
  ['PUS', 'Gimhae International', 'Busan', 'Busan', 'South Korea', 'gimhae'],
  ['PVG', 'Shanghai Pudong', 'Shanghai', 'Shanghai', 'China', 'pudong'],
  ['REP', 'Siem Reap Angkor International', 'Siem Reap', 'Siem Reap', 'Cambodia', 'angkor'],
  ['RGN', 'Yangon International', 'Yangon', 'Yangon', 'Myanmar'],
  ['SHA', 'Shanghai Hongqiao', 'Shanghai', 'Shanghai', 'China', 'hongqiao'],
  ['SGN', 'Tan Son Nhat International', 'Ho Chi Minh City', 'Ho Chi Minh City', 'Vietnam', 'saigon'],
  ['SIN', 'Singapore Changi', 'Singapore', 'Singapore', 'Singapore', 'changi'],
  ['SUB', 'Juanda International', 'Surabaya', 'East Java', 'Indonesia'],
  ['SYD', 'Sydney Kingsford Smith', 'Sydney', 'New South Wales', 'Australia', 'kingsford smith'],
  ['SZX', "Shenzhen Bao'an", 'Shenzhen', 'Guangdong', 'China', 'baoan'],
  ['TFU', 'Chengdu Tianfu', 'Chengdu', 'Sichuan', 'China', 'tianfu'],
  ['TPE', 'Taiwan Taoyuan International', 'Taipei', 'Taoyuan', 'Taiwan', 'taoyuan'],
  ['TSA', 'Taipei Songshan', 'Taipei', 'Taipei', 'Taiwan', 'songshan'],
  ['VTE', 'Wattay International', 'Vientiane', 'Vientiane Prefecture', 'Laos', 'wattay'],
  ['WLG', 'Wellington', 'Wellington', 'Wellington', 'New Zealand'],
  ['XIY', "Xi'an Xianyang", "Xi'an", 'Shaanxi', 'China', 'xianyang'],
  ['ZQN', 'Queenstown', 'Queenstown', 'Otago', 'New Zealand'],
]

export let AIRPORTS = AIRPORT_SEEDS.map(createAirport)

function getAirportSearchScore(airport: AirportRecord, query: string) {
  let bestScore: number | null = null

  for (let [index, value] of airport.searchValue.entries()) {
    if (!value.startsWith(query)) {
      continue
    }

    let score = Math.max(0, 240 - index * 16) + Math.max(0, 120 - (value.length - query.length))
    if (bestScore === null || score > bestScore) {
      bestScore = score
    }
  }

  return bestScore
}

export function searchAirports(query: string | null | undefined) {
  let normalizedQuery = normalizeSearchValue(query ?? '')
  if (normalizedQuery === '') {
    return AIRPORTS
  }

  return AIRPORTS.map((airport) => ({
    airport,
    score: getAirportSearchScore(airport, normalizedQuery),
  }))
    .filter((match) => match.score !== null)
    .sort((left, right) => {
      let scoreDifference = (right.score ?? 0) - (left.score ?? 0)
      if (scoreDifference !== 0) {
        return scoreDifference
      }

      let valueDifference = left.airport.value.localeCompare(right.airport.value)
      if (valueDifference !== 0) {
        return valueDifference
      }

      return left.airport.label.localeCompare(right.airport.label)
    })
    .map((match) => match.airport)
}
