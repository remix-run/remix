export interface SpecDefinition {
  name: string
  values: string[]
}

/** A sub-family shown as its own section, with its own photo and table, on a family page. */
export interface PresentationDefinition {
  name: string
  description: string
  /** What the product photo shows. Used by scripts/generate-product-images.ts. */
  photo: string
}

export interface FamilyDefinition {
  slug: string
  name: string
  description: string
  /** What the family photo shows. Used by scripts/generate-product-images.ts. */
  photo: string
  /** The spec that tells presentations apart, such as "Material" or "Style". */
  presentationLabel: string
  presentations: PresentationDefinition[]
  /** Up to three specs. Every combination becomes a part in each presentation. */
  specs: SpecDefinition[]
  /** Each part is sold in every one of these pack sizes. */
  packQuantities: number[]
  basePrice: number
}

export interface CategoryDefinition {
  slug: string
  name: string
  families: FamilyDefinition[]
}

export interface SectionDefinition {
  slug: string
  name: string
  categories: CategoryDefinition[]
}

/** Formats a length given in sixteenths of an inch, such as 20 → 1 1/4". */
function inches(sixteenths: number): string {
  let whole = Math.floor(sixteenths / 16)
  let remainder = sixteenths % 16
  if (remainder === 0) return `${whole}"`

  let denominator = 16
  while (remainder % 2 === 0) {
    remainder /= 2
    denominator /= 2
  }
  let fraction = `${remainder}/${denominator}`
  return whole === 0 ? `${fraction}"` : `${whole} ${fraction}"`
}

/** Lengths from `from` to `to` sixteenths of an inch, in steps of `step` sixteenths. */
function inchRange(from: number, to: number, step: number): string[] {
  let values: string[] = []
  for (let sixteenths = from; sixteenths <= to; sixteenths += step) values.push(inches(sixteenths))
  return values
}

function millimeters(values: number[]): string[] {
  return values.map((value) => `${value} mm`)
}

const coarseThreads = [
  '#0-80',
  '#2-56',
  '#4-40',
  '#6-32',
  '#8-32',
  '#10-24',
  '1/4"-20',
  '5/16"-18',
  '3/8"-16',
  '7/16"-14',
  '1/2"-13',
  '5/8"-11',
  '3/4"-10',
]
const fineThreads = ['#10-32', '1/4"-28', '5/16"-24', '3/8"-24', '1/2"-20', '5/8"-18']
const metricThreads = ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16']
const machineScrewThreads = [...coarseThreads, ...fineThreads, ...metricThreads]
const boltThreads = [
  '1/4"-20',
  '5/16"-18',
  '3/8"-16',
  '7/16"-14',
  '1/2"-13',
  '9/16"-12',
  '5/8"-11',
  '3/4"-10',
  '7/8"-9',
  '1"-8',
  '1/4"-28',
  '3/8"-24',
  '1/2"-20',
  '5/8"-18',
  '3/4"-16',
  'M6',
  'M8',
  'M10',
  'M12',
  'M16',
  'M20',
  'M24',
]
const nutThreads = [...machineScrewThreads, '7/8"-9', '1"-8', '1 1/4"-7', 'M20', 'M24']
const screwSizes = [
  '#2',
  '#4',
  '#6',
  '#8',
  '#10',
  '#12',
  '1/4"',
  '5/16"',
  '3/8"',
  '7/16"',
  '1/2"',
  '9/16"',
  '5/8"',
  '3/4"',
  '7/8"',
  '1"',
  ...millimeters([2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24]),
]
const shaftDiameters = [
  ...inchRange(2, 32, 1),
  ...inchRange(36, 64, 4),
  ...millimeters([3, 4, 5, 6, 8, 10, 12, 15, 17, 20, 25, 30, 35, 40]),
]
const pipeSizes = ['1/8', '1/4', '3/8', '1/2', '3/4', '1', '1 1/4', '1 1/2', '2', '2 1/2', '3', '4']
const drillDiameters = [
  ...inchRange(1, 32, 1),
  ...inchRange(34, 64, 2),
  ...Array.from({ length: 26 }, (_, index) => `Letter ${String.fromCharCode(65 + index)}`),
  ...Array.from({ length: 40 }, (_, index) => `No. ${index + 1}`),
  ...millimeters([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 11, 12, 13]),
]
const wrenchSizes = [
  ...inchRange(4, 32, 1),
  ...inchRange(34, 48, 2),
  ...millimeters([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 27, 30, 32]),
]
const hexKeySizes = [
  '0.028"',
  '0.035"',
  '0.050"',
  ...inchRange(1, 6, 1),
  '9/64"',
  '5/32"',
  '3/16"',
  '7/32"',
  '1/4"',
  '5/16"',
  '3/8"',
  '7/16"',
  '1/2"',
  '9/16"',
  '5/8"',
  '3/4"',
  ...millimeters([0.7, 0.9, 1.3, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 19]),
]

export const catalog: SectionDefinition[] = [
  {
    slug: 'fastening-and-joining',
    name: 'Fastening & Joining',
    categories: [
      {
        slug: 'screws',
        name: 'Screws & Bolts',
        families: [
          {
            slug: 'socket-head-screws',
            name: 'Socket Head Screws',
            description:
              'A tall, cylindrical head with a hex drive lets you tighten these screws in tight spaces where a wrench will not fit.',
            photo:
              'three black-oxide alloy steel socket head cap screws with hex socket drives, lying side by side at a slight angle',
            presentationLabel: 'Material',
            presentations: [
              {
                name: 'Black-Oxide Alloy Steel',
                description:
                  'The strongest general-purpose socket head screws, with a lightly oiled finish.',
                photo: 'three black-oxide alloy steel socket head cap screws',
              },
              {
                name: 'Zinc-Plated Alloy Steel',
                description: 'A bright zinc coating adds mild corrosion resistance.',
                photo: 'three bright silver zinc-plated alloy steel socket head cap screws',
              },
              {
                name: '18-8 Stainless Steel',
                description: 'Resist rust in wet and outdoor environments.',
                photo: 'three polished 18-8 stainless steel socket head cap screws',
              },
              {
                name: '316 Stainless Steel',
                description: 'Extra resistance to salt water and harsh chemicals.',
                photo: 'three satin-finish 316 stainless steel socket head cap screws',
              },
              {
                name: 'Low-Profile Alloy Steel',
                description: 'A head about half the usual height for tight clearances.',
                photo:
                  'three black-oxide low-profile socket head cap screws with short, wide heads',
              },
              {
                name: 'Titanium',
                description: 'About half the weight of steel with excellent corrosion resistance.',
                photo: 'three gray metallic grade 5 titanium socket head cap screws',
              },
              {
                name: 'Brass',
                description: 'Nonmagnetic and electrically conductive.',
                photo: 'three golden brass socket head cap screws',
              },
              {
                name: 'Nylon',
                description: 'Lightweight, electrically insulating, and gentle on surfaces.',
                photo: 'three white nylon plastic socket head cap screws',
              },
              {
                name: 'Extreme-Strength Alloy Steel',
                description: 'About 20% stronger than standard alloy steel socket head screws.',
                photo: 'three dark gray extreme-strength alloy steel socket head cap screws',
              },
              {
                name: 'Corrosion-Resistant Coated Steel',
                description: 'A silver coating that stands up to 1,000 hours of salt spray.',
                photo: 'three dull silver coated socket head cap screws',
              },
            ],
            specs: [
              { name: 'Thread Size', values: machineScrewThreads },
              { name: 'Length', values: inchRange(2, 96, 2) },
              { name: 'Threading', values: ['Fully Threaded', 'Partially Threaded'] },
            ],
            packQuantities: [10, 50, 100],
            basePrice: 0.12,
          },
          {
            slug: 'hex-head-screws',
            name: 'Hex Head Screws',
            description:
              'The most common bolt for general assembly. Turn the six-sided head with a wrench or socket.',
            photo: 'two zinc-plated steel hex head bolts with fully threaded shanks',
            presentationLabel: 'Material',
            presentations: [
              {
                name: 'Grade 5 Zinc-Plated Steel',
                description: 'Medium-strength bolts for automotive and machinery assembly.',
                photo:
                  'two zinc-plated grade 5 steel hex head bolts with three radial lines on the head',
              },
              {
                name: 'Grade 8 Zinc-Yellow Steel',
                description: 'High-strength bolts for heavy equipment and suspension parts.',
                photo: 'two gold-tinted yellow zinc-plated grade 8 steel hex head bolts',
              },
              {
                name: '18-8 Stainless Steel',
                description: 'Rust-resistant bolts for outdoor and food-processing equipment.',
                photo: 'two 18-8 stainless steel hex head bolts',
              },
              {
                name: '316 Stainless Steel',
                description: 'The best choice for marine and chemical environments.',
                photo: 'two satin-finish 316 stainless steel hex head bolts',
              },
              {
                name: 'Hot-Dip Galvanized Steel',
                description: 'A thick zinc coating protects structural connections outdoors.',
                photo: 'two hot-dip galvanized hex head bolts with a dull, rough gray coating',
              },
              {
                name: 'Black-Oxide Grade 8 Steel',
                description: 'High-strength bolts with a dark, low-glare finish.',
                photo: 'two black-oxide grade 8 steel hex head bolts',
              },
              {
                name: 'Silicon Bronze',
                description: 'Resist corrosion in boats and docks without rusting stains.',
                photo: 'two reddish-gold silicon bronze hex head bolts',
              },
              {
                name: 'Flanged Zinc-Plated Steel',
                description: 'A built-in washer spreads the load, so you need one less part.',
                photo: 'two zinc-plated hex flange head bolts with a wide washer flange',
              },
            ],
            specs: [
              { name: 'Thread Size', values: boltThreads },
              { name: 'Length', values: [...inchRange(8, 64, 4), ...inchRange(72, 256, 8)] },
              { name: 'Threading', values: ['Fully Threaded', 'Partially Threaded'] },
            ],
            packQuantities: [5, 25, 50, 100],
            basePrice: 0.34,
          },
          {
            slug: 'flat-head-screws',
            name: 'Flat Head Screws',
            description:
              'A countersunk head sits flush with the surface, so nothing snags on the finished part.',
            photo:
              'three stainless steel flat head countersunk machine screws with Phillips drives',
            presentationLabel: 'Drive and Material',
            presentations: [
              {
                name: 'Phillips Zinc-Plated Steel',
                description: 'Inexpensive screws for general assembly.',
                photo: 'three zinc-plated steel flat head screws with Phillips drives',
              },
              {
                name: 'Phillips 18-8 Stainless Steel',
                description: 'Rust-resistant flat head screws for enclosures and panels.',
                photo: 'three 18-8 stainless steel flat head screws with Phillips drives',
              },
              {
                name: 'Hex Drive Black-Oxide Alloy Steel',
                description: 'High-strength countersunk screws for tooling and fixtures.',
                photo: 'three black-oxide alloy steel flat head screws with hex socket drives',
              },
              {
                name: 'Hex Drive 18-8 Stainless Steel',
                description: 'Stainless screws that take more torque than Phillips drives.',
                photo: 'three stainless steel flat head screws with hex socket drives',
              },
              {
                name: 'Torx 18-8 Stainless Steel',
                description: 'A six-lobe drive resists cam-out at high torque.',
                photo: 'three stainless steel flat head screws with six-lobe star drives',
              },
              {
                name: 'Slotted Brass',
                description: 'A traditional look for woodworking and restoration.',
                photo: 'three brass flat head screws with slotted drives',
              },
              {
                name: 'Phillips Nylon',
                description: 'Electrically insulating screws for circuit boards.',
                photo: 'three white nylon flat head screws with Phillips drives',
              },
              {
                name: 'Square Drive Zinc-Plated Steel',
                description: 'A square recess grips the driver bit and will not strip easily.',
                photo: 'three zinc-plated steel flat head screws with square drive recesses',
              },
            ],
            specs: [
              { name: 'Thread Size', values: machineScrewThreads },
              { name: 'Length', values: inchRange(2, 64, 2) },
              { name: 'Countersink Angle', values: ['82°', '100°'] },
            ],
            packQuantities: [25, 100, 500],
            basePrice: 0.09,
          },
        ],
      },
      {
        slug: 'nuts',
        name: 'Nuts',
        families: [
          {
            slug: 'hex-nuts',
            name: 'Hex Nuts',
            description: 'Pair these with a bolt or threaded rod to fasten parts together.',
            photo: 'a small group of zinc-plated steel hex nuts, one standing on edge',
            presentationLabel: 'Material',
            presentations: [
              {
                name: 'Zinc-Plated Grade 5 Steel',
                description: 'Medium-strength nuts for grade 5 bolts.',
                photo: 'a few zinc-plated steel hex nuts',
              },
              {
                name: 'Grade 8 Zinc-Yellow Steel',
                description: 'High-strength nuts for grade 8 bolts.',
                photo: 'a few gold-tinted yellow zinc-plated steel hex nuts',
              },
              {
                name: '18-8 Stainless Steel',
                description: 'Rust-resistant nuts for general use.',
                photo: 'a few polished 18-8 stainless steel hex nuts',
              },
              {
                name: '316 Stainless Steel',
                description: 'Extra corrosion resistance for marine hardware.',
                photo: 'a few satin-finish 316 stainless steel hex nuts',
              },
              {
                name: 'Brass',
                description: 'Nonmagnetic nuts for electrical and decorative use.',
                photo: 'a few golden brass hex nuts',
              },
              {
                name: 'Nylon',
                description: 'Lightweight and electrically insulating.',
                photo: 'a few white nylon plastic hex nuts',
              },
              {
                name: 'Heavy Hex Galvanized Steel',
                description: 'Thicker and wider for structural connections.',
                photo: 'a few thick hot-dip galvanized heavy hex nuts',
              },
              {
                name: 'Thin 18-8 Stainless Steel',
                description: 'Jam nuts about half the usual height for tight spaces.',
                photo: 'a few thin stainless steel jam nuts',
              },
              {
                name: 'Black-Oxide Steel',
                description: 'A dark, low-glare finish that matches black-oxide screws.',
                photo: 'a few black-oxide steel hex nuts',
              },
            ],
            specs: [
              { name: 'Thread Size', values: nutThreads },
              { name: 'Thread Direction', values: ['Right Hand', 'Left Hand'] },
              { name: 'Thread Fit', values: ['Class 2B', 'Class 3B'] },
            ],
            packQuantities: [10, 25, 50, 100],
            basePrice: 0.06,
          },
          {
            slug: 'lock-nuts',
            name: 'Lock Nuts',
            description:
              'These nuts resist loosening from vibration without a separate lock washer.',
            photo: 'a few stainless steel nylon-insert lock nuts showing the white nylon ring',
            presentationLabel: 'Locking Style',
            presentations: [
              {
                name: 'Nylon-Insert Zinc-Plated Steel',
                description: 'A nylon ring grips the threads to stop loosening.',
                photo: 'a few zinc-plated steel nylon-insert lock nuts with white nylon rings',
              },
              {
                name: 'Nylon-Insert 18-8 Stainless Steel',
                description: 'Rust-resistant nylon-insert lock nuts.',
                photo: 'a few stainless steel nylon-insert lock nuts with white nylon rings',
              },
              {
                name: 'Thin Nylon-Insert Steel',
                description: 'A low profile for tight clearances.',
                photo: 'a few thin zinc-plated nylon-insert jam lock nuts',
              },
              {
                name: 'Serrated Flange Steel',
                description: 'Serrations bite into the surface, so no washer is needed.',
                photo: 'a few zinc-plated serrated flange lock nuts with ridged flanges',
              },
              {
                name: 'Distorted-Thread Steel',
                description: 'All-metal nuts for temperatures too high for nylon.',
                photo: 'a few gold-tinted distorted-thread top-lock steel nuts',
              },
              {
                name: 'Nylon-Insert Flange Steel',
                description: 'Combines a nylon insert with a built-in washer.',
                photo: 'a few zinc-plated flange lock nuts with white nylon inserts',
              },
              {
                name: 'Keps Steel',
                description: 'A free-spinning toothed lock washer comes attached.',
                photo: 'a few keps nuts with attached external-tooth lock washers',
              },
              {
                name: 'All-Metal 316 Stainless Steel',
                description: 'Prevailing-torque nuts for heat and corrosion.',
                photo: 'a few all-metal stainless steel prevailing-torque lock nuts',
              },
            ],
            specs: [
              { name: 'Thread Size', values: nutThreads },
              { name: 'Thread Direction', values: ['Right Hand', 'Left Hand'] },
              { name: 'Finish', values: ['Plain', 'Wax Coated'] },
            ],
            packQuantities: [10, 50, 100],
            basePrice: 0.11,
          },
        ],
      },
      {
        slug: 'washers',
        name: 'Washers',
        families: [
          {
            slug: 'flat-washers',
            name: 'Flat Washers',
            description:
              'Spread the load of a fastener across a wider area and protect the surface.',
            photo: 'a short stack of zinc-plated steel flat washers with one lying beside it',
            presentationLabel: 'Material',
            presentations: [
              {
                name: 'Zinc-Plated Steel',
                description: 'General-purpose washers for everyday assembly.',
                photo: 'a short stack of zinc-plated steel flat washers',
              },
              {
                name: '18-8 Stainless Steel',
                description: 'Rust-resistant washers for outdoor use.',
                photo: 'a short stack of 18-8 stainless steel flat washers',
              },
              {
                name: '316 Stainless Steel',
                description: 'Extra corrosion resistance for marine use.',
                photo: 'a short stack of satin 316 stainless steel flat washers',
              },
              {
                name: 'Brass',
                description: 'Nonmagnetic and conductive.',
                photo: 'a short stack of golden brass flat washers',
              },
              {
                name: 'Nylon',
                description: 'Insulate electrical connections and protect painted surfaces.',
                photo: 'a short stack of white nylon flat washers',
              },
              {
                name: 'Fender Zinc-Plated Steel',
                description: 'An extra-large outside diameter for thin sheet metal.',
                photo:
                  'a few zinc-plated fender washers with large outside diameters and small holes',
              },
              {
                name: 'Copper',
                description: 'Soft washers that seal fluid fittings.',
                photo: 'a short stack of shiny copper flat washers',
              },
              {
                name: 'Hardened Black-Oxide Steel',
                description: 'Will not deform under high-strength bolts.',
                photo: 'a short stack of black-oxide hardened steel flat washers',
              },
              {
                name: 'Neoprene-Bonded Steel',
                description: 'A rubber backing seals out water.',
                photo: 'a few steel sealing washers with black neoprene rubber bonded to one side',
              },
            ],
            specs: [
              { name: 'For Screw Size', values: screwSizes },
              { name: 'Thickness', values: ['Extra Thin', 'Thin', 'Standard', 'Thick'] },
              { name: 'Outside Diameter', values: ['Narrow', 'Standard', 'Wide', 'Extra Wide'] },
            ],
            packQuantities: [25, 100, 500],
            basePrice: 0.03,
          },
          {
            slug: 'split-lock-washers',
            name: 'Split Lock Washers',
            description:
              'The split coil bites into the nut and the surface to keep fasteners tight.',
            photo: 'several stainless steel split lock washers',
            presentationLabel: 'Material',
            presentations: [
              {
                name: 'Zinc-Plated Steel',
                description: 'General-purpose lock washers.',
                photo: 'several zinc-plated steel split lock washers',
              },
              {
                name: '18-8 Stainless Steel',
                description: 'Rust-resistant lock washers.',
                photo: 'several polished 18-8 stainless steel split lock washers',
              },
              {
                name: '316 Stainless Steel',
                description: 'Extra corrosion resistance for marine use.',
                photo: 'several satin 316 stainless steel split lock washers',
              },
              {
                name: 'Black-Oxide Steel',
                description: 'Match black-oxide socket head screws.',
                photo: 'several black-oxide steel split lock washers',
              },
              {
                name: 'Phosphor Bronze',
                description: 'Nonmagnetic and resists saltwater.',
                photo: 'several reddish-gold phosphor bronze split lock washers',
              },
              {
                name: 'High-Collar Steel',
                description: 'A smaller outside diameter fits counterbored holes.',
                photo: 'several narrow high-collar steel split lock washers',
              },
              {
                name: 'Silicon Bronze',
                description: 'Pair with silicon bronze bolts in marine hardware.',
                photo: 'several silicon bronze split lock washers',
              },
              {
                name: 'Yellow Zinc-Plated Steel',
                description: 'Match grade 8 bolts and nuts.',
                photo: 'several gold-tinted yellow zinc-plated split lock washers',
              },
            ],
            specs: [
              { name: 'For Screw Size', values: screwSizes },
              { name: 'Duty', values: ['Light', 'Regular', 'Heavy', 'Extra Duty'] },
            ],
            packQuantities: [25, 100, 500, 1000],
            basePrice: 0.03,
          },
        ],
      },
    ],
  },
  {
    slug: 'power-transmission',
    name: 'Power Transmission',
    categories: [
      {
        slug: 'bearings',
        name: 'Bearings',
        families: [
          {
            slug: 'ball-bearings',
            name: 'Ball Bearings',
            description:
              'Support rotating shafts with low friction in motors, rollers, and fixtures.',
            photo:
              'a sealed steel radial ball bearing with black rubber seals, angled to show its face',
            presentationLabel: 'Style',
            presentations: [
              {
                name: 'Steel Radial',
                description: 'The most common bearing for general machinery.',
                photo: 'a steel radial ball bearing with black rubber seals',
              },
              {
                name: 'Stainless Steel Radial',
                description: 'Resist washdowns and humid environments.',
                photo: 'a bright stainless steel radial ball bearing with metal shields',
              },
              {
                name: 'Flanged',
                description: 'A lip on the outer ring locates the bearing in its housing.',
                photo: 'a steel ball bearing with a flange lip on its outer ring',
              },
              {
                name: 'Ceramic Hybrid',
                description: 'Ceramic balls run faster and cooler than steel.',
                photo: 'an open ball bearing with steel rings and black ceramic balls visible',
              },
              {
                name: 'Thin-Section',
                description: 'A large bore with a very thin cross section saves space.',
                photo: 'a thin-section ball bearing with a large bore and narrow rings',
              },
              {
                name: 'Miniature',
                description: 'Tiny bearings for instruments and small motors.',
                photo: 'three tiny miniature ball bearings of different sizes',
              },
              {
                name: 'Double-Row Angular-Contact',
                description: 'Two rows of balls carry heavy combined loads.',
                photo: 'a wide double-row angular-contact ball bearing',
              },
              {
                name: 'Plastic with Glass Balls',
                description: 'Corrosion-proof bearings that run without lubrication.',
                photo: 'a white acetal plastic ball bearing with clear glass balls',
              },
              {
                name: 'High-Temperature',
                description: 'Graphite lubrication for ovens and kilns.',
                photo: 'an open steel ball bearing with a dark heat-treated finish',
              },
            ],
            specs: [
              { name: 'Shaft Diameter', values: shaftDiameters },
              { name: 'Seal Type', values: ['Open', 'Shielded', 'Sealed'] },
              { name: 'Precision', values: ['ABEC-1', 'ABEC-3', 'ABEC-5', 'ABEC-7', 'ABEC-9'] },
            ],
            packQuantities: [1, 2, 5, 10],
            basePrice: 4.2,
          },
          {
            slug: 'mounted-bearings',
            name: 'Mounted Bearings',
            description: 'A bearing pressed into a housing that bolts straight onto a frame.',
            photo: 'a gray cast iron pillow block mounted bearing with a steel bearing insert',
            presentationLabel: 'Housing Style',
            presentations: [
              {
                name: 'Pillow Block',
                description: 'Mounts on a surface parallel to the shaft.',
                photo: 'a gray cast iron pillow block mounted bearing',
              },
              {
                name: '2-Bolt Flange',
                description: 'Mounts on a wall perpendicular to the shaft.',
                photo: 'a gray cast iron two-bolt flange mounted bearing',
              },
              {
                name: '4-Bolt Flange',
                description: 'Square flange for heavier loads.',
                photo: 'a gray cast iron square four-bolt flange mounted bearing',
              },
              {
                name: '3-Bolt Flange',
                description: 'A triangular flange for tight corners.',
                photo: 'a gray cast iron triangular three-bolt flange mounted bearing',
              },
              {
                name: 'Take-Up',
                description: 'Slides in a frame to tension belts and conveyors.',
                photo: 'a gray cast iron take-up mounted bearing with guide slots',
              },
              {
                name: 'Tapped-Base Pillow Block',
                description: 'Bolts up from beneath for a clean mounting surface.',
                photo: 'a compact pillow block mounted bearing with a flat tapped base',
              },
              {
                name: 'Hanger',
                description: 'Suspends a shaft from above, as in screw conveyors.',
                photo: 'a cast iron hanger mounted bearing with a vertical mounting arm',
              },
              {
                name: 'Cylindrical Cartridge',
                description: 'Presses into a bored hole in your own housing.',
                photo: 'a cylindrical cast iron cartridge mounted bearing',
              },
            ],
            specs: [
              { name: 'Shaft Diameter', values: shaftDiameters },
              {
                name: 'Housing Material',
                values: ['Cast Iron', 'Stainless Steel', 'Thermoplastic'],
              },
              {
                name: 'Shaft Locking',
                values: ['Set Screw', 'Eccentric Collar', 'Concentric Collar'],
              },
            ],
            packQuantities: [1, 2],
            basePrice: 18.5,
          },
        ],
      },
      {
        slug: 'gears',
        name: 'Gears',
        families: [
          {
            slug: 'spur-gears',
            name: 'Spur Gears',
            description: 'Straight teeth transfer motion between parallel shafts.',
            photo: 'a steel spur gear with a hub and a set screw',
            presentationLabel: 'Material and Style',
            presentations: [
              {
                name: 'Steel with Hub',
                description: 'A hub with a set screw locks the gear to its shaft.',
                photo: 'a steel spur gear with a raised hub and a set screw',
              },
              {
                name: 'Steel Plate',
                description: 'A flat, hubless gear for custom mounting.',
                photo: 'a flat steel plate-style spur gear without a hub',
              },
              {
                name: 'Hardened Steel',
                description: 'Heat-treated teeth for high loads and long life.',
                photo: 'a dark heat-treated hardened steel spur gear with a hub',
              },
              {
                name: 'Stainless Steel',
                description: 'For food, medical, and washdown machinery.',
                photo: 'a polished stainless steel spur gear with a hub',
              },
              {
                name: 'Brass',
                description: 'Quiet, corrosion-resistant gears for light loads.',
                photo: 'a golden brass spur gear with a hub',
              },
              {
                name: 'Nylon',
                description: 'Quiet and self-lubricating.',
                photo: 'a white nylon spur gear with a hub',
              },
              {
                name: 'Acetal',
                description: 'Stiffer than nylon and holds tight tolerances.',
                photo: 'a black acetal plastic spur gear',
              },
              {
                name: 'Cast Iron',
                description: 'Large, inexpensive gears for heavy machinery.',
                photo: 'a large gray cast iron spur gear with spokes',
              },
            ],
            specs: [
              {
                name: 'Pitch',
                values: ['64', '48', '32', '24', '20', '16', '12', '10', '8', '6', '5', '4'],
              },
              {
                name: 'Number of Teeth',
                values: Array.from({ length: 60 }, (_, index) => String(12 + index * 2)),
              },
              { name: 'Pressure Angle', values: ['14 1/2°', '20°'] },
            ],
            packQuantities: [1, 2],
            basePrice: 7.4,
          },
        ],
      },
      {
        slug: 'shaft-collars',
        name: 'Shaft Collars',
        families: [
          {
            slug: 'clamp-on-shaft-collars',
            name: 'Shaft Collars',
            description: 'Hold components in place on a shaft and act as mechanical stops.',
            photo: 'a black-oxide steel one-piece clamp-on shaft collar with its clamping screw',
            presentationLabel: 'Style',
            presentations: [
              {
                name: 'One-Piece Clamp-On',
                description: 'Clamps evenly around the shaft without marring it.',
                photo: 'a black-oxide one-piece clamp-on shaft collar with one clamping screw',
              },
              {
                name: 'Two-Piece Clamp-On',
                description: 'Install and remove without taking other parts off the shaft.',
                photo: 'a black-oxide two-piece clamp-on shaft collar with two screws',
              },
              {
                name: 'Set Screw',
                description: 'The simplest and least expensive collar.',
                photo: 'a plain steel set screw shaft collar with a set screw on top',
              },
              {
                name: 'Quick-Release',
                description: 'A lever lets you adjust the position by hand.',
                photo: 'an aluminum shaft collar with a quick-release clamping lever',
              },
              {
                name: 'Threaded One-Piece',
                description: 'Fits threaded shafts and lead screws.',
                photo: 'a one-piece clamp-on shaft collar with internal threads',
              },
              {
                name: 'Hinged',
                description: 'Opens on a hinge for fast installation.',
                photo: 'a steel hinged shaft collar opened slightly on its hinge',
              },
              {
                name: 'Keyed',
                description: 'A keyway keeps the collar from rotating.',
                photo: 'a black-oxide clamp-on shaft collar with a keyway slot in the bore',
              },
              {
                name: 'Flanged Mounting',
                description: 'Tapped holes on the face mount pulleys and sprockets.',
                photo: 'a clamp-on shaft collar with a flange and tapped holes on its face',
              },
              {
                name: 'Heavy-Duty Two-Piece',
                description: 'Wider and thicker for high axial loads.',
                photo: 'a wide heavy-duty two-piece steel shaft collar',
              },
            ],
            specs: [
              { name: 'Shaft Diameter', values: shaftDiameters },
              {
                name: 'Material',
                values: [
                  'Black-Oxide Steel',
                  'Zinc-Plated Steel',
                  '303 Stainless Steel',
                  'Aluminum',
                ],
              },
              { name: 'Bore', values: ['Round', 'Keyed', 'D-Profile'] },
            ],
            packQuantities: [1, 5, 10],
            basePrice: 3.1,
          },
        ],
      },
    ],
  },
  {
    slug: 'pipe-tubing-and-fittings',
    name: 'Pipe, Tubing & Fittings',
    categories: [
      {
        slug: 'pipe-fittings',
        name: 'Pipe Fittings',
        families: [
          {
            slug: 'threaded-pipe-fittings',
            name: 'Threaded Pipe Fittings',
            description: 'NPT fittings for connecting, turning, and capping threaded pipe.',
            photo: 'a brass 90-degree threaded pipe elbow fitting',
            presentationLabel: 'Fitting Type',
            presentations: [
              {
                name: '90° Elbow',
                description: 'Turn a line at a right angle.',
                photo: 'a brass 90-degree threaded pipe elbow',
              },
              {
                name: '45° Elbow',
                description: 'Make a gentler turn with less flow restriction.',
                photo: 'a brass 45-degree threaded pipe elbow',
              },
              {
                name: 'Tee',
                description: 'Split one line into two.',
                photo: 'a brass threaded pipe tee fitting',
              },
              {
                name: 'Cross',
                description: 'Connect four lines at one point.',
                photo: 'a brass four-way threaded pipe cross fitting',
              },
              {
                name: 'Coupling',
                description: 'Join two pipes of the same size.',
                photo: 'a brass threaded pipe coupling',
              },
              {
                name: 'Reducing Coupling',
                description: 'Join two pipes of different sizes.',
                photo: 'a brass threaded reducing coupling with one end smaller than the other',
              },
              {
                name: 'Cap',
                description: 'Seal the male end of a pipe.',
                photo: 'a brass threaded pipe cap',
              },
              {
                name: 'Plug',
                description: 'Seal a female port.',
                photo: 'a brass hex-head threaded pipe plug',
              },
              {
                name: 'Union',
                description: 'Disconnect a line without turning the pipe.',
                photo: 'a brass threaded pipe union with a hex nut in the middle',
              },
              {
                name: 'Hex Nipple',
                description: 'Connect two female fittings with a short threaded piece.',
                photo: 'a brass hex nipple with threads on both ends',
              },
            ],
            specs: [
              { name: 'Pipe Size', values: pipeSizes },
              {
                name: 'Material',
                values: [
                  'Brass',
                  '304 Stainless Steel',
                  '316 Stainless Steel',
                  'Black Steel',
                  'Galvanized Steel',
                  'PVC',
                  'Bronze',
                  'Copper',
                ],
              },
              { name: 'Pressure Class', values: ['150', '3000', '6000'] },
            ],
            packQuantities: [1, 5],
            basePrice: 2.6,
          },
        ],
      },
      {
        slug: 'tubing',
        name: 'Tubing',
        families: [
          {
            slug: 'flexible-tubing',
            name: 'Flexible Tubing',
            description: 'Route air, water, and chemicals around corners.',
            photo: 'a neat coil of clear flexible PVC tubing',
            presentationLabel: 'Material',
            presentations: [
              {
                name: 'Clear PVC',
                description: 'See the flow inside for water and light chemicals.',
                photo: 'a coil of clear flexible PVC tubing',
              },
              {
                name: 'Polyurethane',
                description: 'Tough, kink-resistant tubing for pneumatic lines.',
                photo: 'a coil of translucent blue polyurethane tubing',
              },
              {
                name: 'Silicone',
                description: 'Flexible from -80° to 400° F.',
                photo: 'a coil of translucent white silicone tubing',
              },
              {
                name: 'Nylon',
                description: 'Rigid tubing for high-pressure air and fuel.',
                photo: 'a coil of black nylon tubing',
              },
              {
                name: 'PTFE',
                description: 'Resists nearly every chemical.',
                photo: 'a coil of opaque white PTFE tubing',
              },
              {
                name: 'FEP',
                description: 'Clear fluoropolymer tubing with PTFE-like resistance.',
                photo: 'a coil of clear glossy FEP tubing',
              },
              {
                name: 'Polyethylene',
                description: 'Inexpensive tubing for water and air.',
                photo: 'a coil of semi-clear natural polyethylene tubing',
              },
              {
                name: 'Braid-Reinforced PVC',
                description: 'Embedded polyester braid handles higher pressure.',
                photo:
                  'a coil of clear PVC tubing with white braided reinforcement inside the wall',
              },
              {
                name: 'Food-Grade Rubber',
                description: 'Soft tubing for beverage and dairy lines.',
                photo: 'a coil of tan food-grade rubber tubing',
              },
            ],
            specs: [
              { name: 'ID', values: [...inchRange(1, 16, 1), ...inchRange(20, 32, 4)] },
              {
                name: 'Wall Thickness',
                values: ['1/64"', '1/32"', '3/64"', '1/16"', '3/32"', '1/8"', '3/16"', '1/4"'],
              },
              { name: 'Hardness', values: ['Soft', 'Medium', 'Firm'] },
            ],
            packQuantities: [10, 25, 50, 100, 250, 500],
            basePrice: 0.48,
          },
        ],
      },
      {
        slug: 'hose-clamps',
        name: 'Hose Clamps',
        families: [
          {
            slug: 'hose-clamps',
            name: 'Hose Clamps',
            description: 'Seal hose onto barbed fittings so it will not slip off under pressure.',
            photo: 'a stainless steel worm-drive hose clamp',
            presentationLabel: 'Style',
            presentations: [
              {
                name: 'Worm-Drive',
                description: 'Tighten with a screwdriver over a wide size range.',
                photo: 'a stainless steel worm-drive hose clamp',
              },
              {
                name: 'Micro Worm-Drive',
                description: 'A narrow band for small hoses.',
                photo: 'a small narrow-band stainless steel worm-drive hose clamp',
              },
              {
                name: 'Constant-Tension',
                description: 'Springs adjust as the hose expands and contracts.',
                photo: 'a worm-drive hose clamp with stacked spring washers on the screw',
              },
              {
                name: 'T-Bolt',
                description: 'A heavy bolt and nut for large, high-pressure hoses.',
                photo: 'a stainless steel T-bolt hose clamp with a hex nut',
              },
              {
                name: 'Ear',
                description: 'Crimp closed for a tamper-resistant seal.',
                photo: 'a stainless steel single-ear crimp hose clamp',
              },
              {
                name: 'Spring',
                description: 'Squeeze the tabs to install by hand.',
                photo: 'a zinc-plated spring band hose clamp with two tabs',
              },
              {
                name: 'Quick-Release',
                description: 'Opens fully to wrap around hose that is already installed.',
                photo: 'a stainless steel quick-release worm-drive hose clamp with an open latch',
              },
              {
                name: 'Double-Wire',
                description: 'Two wire loops grip hose evenly.',
                photo: 'a zinc-plated double-wire hose clamp with a screw',
              },
            ],
            specs: [
              {
                name: 'Clamp ID Range',
                values: inchRange(4, 72, 2).map((size, index, sizes) =>
                  index + 4 < sizes.length
                    ? `${size}-${sizes[index + 4]}`
                    : `${size}-${inches(80 + index)}`,
                ),
              },
              {
                name: 'Band Material',
                values: ['Zinc-Plated Steel', '304 Stainless Steel', '316 Stainless Steel'],
              },
              { name: 'Band Width', values: ['5/16"', '1/2"', '9/16"'] },
            ],
            packQuantities: [1, 10, 50],
            basePrice: 1.1,
          },
        ],
      },
    ],
  },
  {
    slug: 'raw-materials',
    name: 'Raw Materials',
    categories: [
      {
        slug: 'sheets-and-plates',
        name: 'Sheets & Plates',
        families: [
          {
            slug: 'aluminum-sheets',
            name: 'Aluminum Sheets',
            description: 'Lightweight and easy to machine, bend, and weld.',
            photo:
              'a rectangular sheet of brushed aluminum, shown at an angle to reveal its thickness',
            presentationLabel: 'Alloy and Finish',
            presentations: [
              {
                name: '6061',
                description: 'The most versatile alloy for machined parts.',
                photo: 'a rectangular sheet of plain mill-finish 6061 aluminum',
              },
              {
                name: '5052',
                description: 'Bends easily without cracking.',
                photo: 'a bent sheet of 5052 aluminum with a crisp 90-degree fold',
              },
              {
                name: '3003',
                description: 'An inexpensive alloy for general fabrication.',
                photo: 'a thin rectangular sheet of 3003 aluminum',
              },
              {
                name: '7075',
                description: 'Nearly as strong as steel at a third of the weight.',
                photo: 'a thick rectangular plate of 7075 aluminum',
              },
              {
                name: '2024',
                description: 'High fatigue strength for aircraft parts.',
                photo: 'a rectangular sheet of 2024 aluminum with a slight sheen',
              },
              {
                name: 'Diamond Tread Plate',
                description: 'A raised pattern makes a slip-resistant surface.',
                photo: 'a rectangular aluminum diamond tread plate',
              },
              {
                name: 'Perforated',
                description: 'Round holes for guards, vents, and screens.',
                photo: 'a rectangular perforated aluminum sheet with round holes',
              },
              {
                name: 'Black Anodized',
                description: 'A hard, durable black finish.',
                photo: 'a rectangular black anodized aluminum sheet',
              },
              {
                name: 'Mirror Finish',
                description: 'A highly reflective polished surface.',
                photo: 'a rectangular mirror-polished aluminum sheet with a reflection',
              },
            ],
            specs: [
              {
                name: 'Thickness',
                values: [
                  '0.016"',
                  '0.020"',
                  '0.025"',
                  '0.032"',
                  '0.040"',
                  '0.050"',
                  '0.063"',
                  '0.080"',
                  '0.090"',
                  '0.100"',
                  '0.125"',
                  '0.160"',
                  '0.190"',
                  '0.250"',
                  '0.313"',
                  '0.375"',
                  '0.500"',
                  '0.625"',
                  '0.750"',
                  '1.000"',
                ],
              },
              {
                name: 'Size',
                values: [
                  '6" × 6"',
                  '6" × 12"',
                  '12" × 12"',
                  '12" × 24"',
                  '12" × 36"',
                  '12" × 48"',
                  '24" × 24"',
                  '24" × 36"',
                  '24" × 48"',
                  '36" × 36"',
                  '36" × 48"',
                  '48" × 48"',
                  '48" × 96"',
                ],
              },
              { name: 'Temper', values: ['O', 'H32', 'T6'] },
            ],
            packQuantities: [1, 5, 10],
            basePrice: 6.8,
          },
          {
            slug: 'plastic-sheets',
            name: 'Plastic Sheets',
            description:
              'Clear, tough, slippery, or chemical-resistant sheet for guards and fixtures.',
            photo: 'a clear acrylic plastic sheet, shown at an angle with a slight edge reflection',
            presentationLabel: 'Material',
            presentations: [
              {
                name: 'Clear Acrylic',
                description: 'Glass-like clarity at half the weight.',
                photo: 'a clear acrylic sheet at an angle with polished edges',
              },
              {
                name: 'Polycarbonate',
                description: 'Virtually unbreakable clear sheet for guards.',
                photo: 'a slightly blue-tinted clear polycarbonate sheet at an angle',
              },
              {
                name: 'HDPE',
                description: 'Tough, moisture-proof, and easy to cut.',
                photo: 'an opaque white HDPE plastic sheet',
              },
              {
                name: 'Acetal',
                description: 'Stiff and slippery for precision machined parts.',
                photo: 'a black acetal plastic sheet',
              },
              {
                name: 'Nylon',
                description: 'Wear-resistant sheet for bushings and wear strips.',
                photo: 'an off-white cast nylon sheet',
              },
              {
                name: 'UHMW',
                description: 'The most slippery and abrasion-resistant plastic.',
                photo: 'a translucent white UHMW polyethylene sheet',
              },
              {
                name: 'Gray PVC',
                description: 'Chemical-resistant sheet for tanks and ducts.',
                photo: 'a dark gray rigid PVC sheet',
              },
              {
                name: 'PTFE',
                description: 'Withstands extreme heat and chemicals.',
                photo: 'a thick opaque white PTFE sheet',
              },
              {
                name: 'Black ABS',
                description: 'Easy to thermoform into housings.',
                photo: 'a black ABS plastic sheet with a lightly textured surface',
              },
            ],
            specs: [
              {
                name: 'Thickness',
                values: [
                  '1/32"',
                  '1/16"',
                  '3/32"',
                  '1/8"',
                  '3/16"',
                  '1/4"',
                  '5/16"',
                  '3/8"',
                  '1/2"',
                  '5/8"',
                  '3/4"',
                  '7/8"',
                  '1"',
                  '1 1/4"',
                  '1 1/2"',
                  '2"',
                ],
              },
              {
                name: 'Size',
                values: [
                  '6" × 6"',
                  '6" × 12"',
                  '12" × 12"',
                  '12" × 24"',
                  '12" × 36"',
                  '12" × 48"',
                  '24" × 24"',
                  '24" × 36"',
                  '24" × 48"',
                  '36" × 36"',
                  '48" × 48"',
                  '48" × 96"',
                ],
              },
              { name: 'Color', values: ['Natural', 'Black', 'White'] },
            ],
            packQuantities: [1, 5, 10],
            basePrice: 5.2,
          },
        ],
      },
      {
        slug: 'rods-and-bars',
        name: 'Rods & Bars',
        families: [
          {
            slug: 'metal-rods',
            name: 'Metal Rods',
            description: 'Round stock for shafts, pins, and machined parts.',
            photo:
              'three short lengths of round metal rod: carbon steel, stainless steel, and aluminum',
            presentationLabel: 'Material',
            presentations: [
              {
                name: '1018 Carbon Steel',
                description: 'Easy to machine and weld.',
                photo: 'three short lengths of dark gray 1018 carbon steel rod',
              },
              {
                name: '4140 Alloy Steel',
                description: 'Tough and strong for shafts and axles.',
                photo: 'three short lengths of dark 4140 alloy steel rod',
              },
              {
                name: '303 Stainless Steel',
                description: 'The easiest stainless steel to machine.',
                photo: 'three short lengths of bright 303 stainless steel rod',
              },
              {
                name: '316 Stainless Steel',
                description: 'The most corrosion-resistant common stainless steel.',
                photo: 'three short lengths of satin 316 stainless steel rod',
              },
              {
                name: '6061 Aluminum',
                description: 'Lightweight and easy to machine.',
                photo: 'three short lengths of 6061 aluminum rod',
              },
              {
                name: 'Brass',
                description: 'Machines cleanly into fittings and decorative parts.',
                photo: 'three short lengths of golden brass rod',
              },
              {
                name: 'Copper',
                description: 'The best electrical and thermal conductor.',
                photo: 'three short lengths of shiny copper rod',
              },
              {
                name: 'O1 Tool Steel Drill Rod',
                description: 'Precision-ground rod for punches and dies.',
                photo: 'three short lengths of precision ground tool steel drill rod',
              },
              {
                name: 'Titanium',
                description: 'Strong, light, and corrosion-resistant.',
                photo: 'three short lengths of gray titanium rod',
              },
            ],
            specs: [
              { name: 'Diameter', values: shaftDiameters },
              {
                name: 'Length',
                values: [
                  '6"',
                  '1 ft.',
                  '1 1/2 ft.',
                  '2 ft.',
                  '3 ft.',
                  '4 ft.',
                  '6 ft.',
                  '8 ft.',
                  '10 ft.',
                  '12 ft.',
                ],
              },
              { name: 'Tolerance', values: ['Standard', 'Precision', 'Ultra-Precision'] },
            ],
            packQuantities: [1],
            basePrice: 2.9,
          },
        ],
      },
    ],
  },
  {
    slug: 'tools',
    name: 'Tools',
    categories: [
      {
        slug: 'hand-tools',
        name: 'Hand Tools',
        families: [
          {
            slug: 'hex-keys',
            name: 'Hex Keys',
            description: 'Drive socket head screws and set screws.',
            photo: 'a black-oxide L-shaped hex key',
            presentationLabel: 'Style',
            presentations: [
              {
                name: 'L-Key',
                description: 'The classic L shape for leverage or speed.',
                photo: 'a black-oxide L-shaped hex key',
              },
              {
                name: 'Ball-End L-Key',
                description: 'Reach screws at an angle up to 25°.',
                photo: 'a black-oxide L-shaped hex key with a ball-shaped tip on the long arm',
              },
              {
                name: 'Long-Arm L-Key',
                description: 'Reach deeply recessed screws.',
                photo: 'a long-arm black-oxide L-shaped hex key',
              },
              {
                name: 'Stubby L-Key',
                description: 'Fits where a standard key is too long.',
                photo: 'a short stubby chrome L-shaped hex key',
              },
              {
                name: 'T-Handle',
                description: 'A comfortable grip for fast turning.',
                photo: 'a hex key with a red plastic T-handle',
              },
              {
                name: 'Ball-End T-Handle',
                description: 'T-handle comfort with ball-end reach.',
                photo: 'a ball-end hex key with a black plastic T-handle',
              },
              {
                name: 'P-Handle',
                description: 'A side spin tip for quick runs.',
                photo: 'a hex key with a black P-shaped handle',
              },
              {
                name: 'Screwdriver-Style',
                description: 'A cushioned handle for precise control.',
                photo: 'a hex screwdriver with a black and yellow cushioned handle',
              },
              {
                name: 'Socket Bit',
                description: 'Use with a ratchet or torque wrench.',
                photo: 'a chrome 3/8 inch drive socket with a hex bit',
              },
            ],
            specs: [
              { name: 'Size', values: hexKeySizes },
              { name: 'Finish', values: ['Black Oxide', 'Chrome', 'Bright'] },
            ],
            packQuantities: [1, 5, 10],
            basePrice: 1.6,
          },
          {
            slug: 'wrenches',
            name: 'Wrenches',
            description: 'Grip hex heads and nuts from the side or from above.',
            photo: 'a chrome combination wrench with an open end and a box end',
            presentationLabel: 'Type',
            presentations: [
              {
                name: 'Combination',
                description: 'An open end and a box end in one tool.',
                photo: 'a chrome combination wrench',
              },
              {
                name: 'Open-End',
                description: 'Slide onto nuts from the side.',
                photo: 'a chrome double open-end wrench',
              },
              {
                name: 'Box-End',
                description: 'Grip all six sides for high torque.',
                photo: 'a chrome double box-end wrench',
              },
              {
                name: 'Ratcheting Combination',
                description: 'Turn without lifting the wrench off the nut.',
                photo: 'a chrome ratcheting combination wrench with a geared box end',
              },
              {
                name: 'Adjustable',
                description: 'One wrench for many sizes.',
                photo: 'a chrome adjustable wrench',
              },
              {
                name: 'Flare-Nut',
                description: 'Grip tubing nuts without rounding them.',
                photo: 'a chrome flare-nut wrench with a slotted box end',
              },
              {
                name: 'Stubby Combination',
                description: 'A short handle for tight quarters.',
                photo: 'a short stubby chrome combination wrench',
              },
              {
                name: 'Offset Box-End',
                description: 'Angled heads clear surrounding parts.',
                photo: 'a chrome offset box-end wrench with deeply angled heads',
              },
              {
                name: 'Thin Open-End',
                description: 'Fit jam nuts and narrow spaces.',
                photo: 'a thin chrome open-end wrench',
              },
            ],
            specs: [
              { name: 'Size', values: wrenchSizes },
              { name: 'Finish', values: ['Chrome', 'Black Oxide', 'Black Industrial'] },
            ],
            packQuantities: [1],
            basePrice: 8.2,
          },
        ],
      },
      {
        slug: 'drill-bits',
        name: 'Drill Bits',
        families: [
          {
            slug: 'twist-drill-bits',
            name: 'Twist Drill Bits',
            description: 'General-purpose bits for drilling holes in metal, wood, and plastic.',
            photo: 'a high-speed steel twist drill bit with a bright finish',
            presentationLabel: 'Material and Coating',
            presentations: [
              {
                name: 'High-Speed Steel',
                description: 'General-purpose bits for wood, plastic, and soft metal.',
                photo: 'a bright high-speed steel twist drill bit',
              },
              {
                name: 'Black-Oxide High-Speed Steel',
                description: 'A coating that holds lubricant and resists rust.',
                photo: 'a black-oxide high-speed steel twist drill bit',
              },
              {
                name: 'Cobalt Steel',
                description: 'Drill hard metals such as stainless steel.',
                photo: 'a golden-bronze cobalt steel twist drill bit',
              },
              {
                name: 'Titanium Nitride Coated',
                description: 'A gold coating reduces friction and heat.',
                photo: 'a bright gold titanium nitride coated twist drill bit',
              },
              {
                name: 'Solid Carbide',
                description: 'The hardest and most heat-resistant bits.',
                photo: 'a dull gray solid carbide twist drill bit',
              },
              {
                name: 'Left-Hand',
                description: 'Often backs out broken screws while drilling.',
                photo: 'a left-hand spiral black-oxide twist drill bit',
              },
              {
                name: 'Parabolic Flute',
                description: 'Wide flutes clear chips from deep holes.',
                photo: 'a high-speed steel drill bit with wide parabolic flutes',
              },
              {
                name: 'Screw-Machine Length',
                description: 'Short and rigid for accurate holes.',
                photo: 'a short screw-machine-length twist drill bit',
              },
              {
                name: 'Aluminum Drilling',
                description: 'Polished flutes prevent chips from sticking.',
                photo: 'a highly polished twist drill bit with wide flutes',
              },
            ],
            specs: [
              { name: 'Diameter', values: drillDiameters },
              {
                name: 'Length',
                values: ["Jobbers'", 'Stubby', 'Extra Long', 'Aircraft Extension'],
              },
              { name: 'Point Angle', values: ['118°', '135°'] },
            ],
            packQuantities: [1, 6, 12, 24],
            basePrice: 1.2,
          },
        ],
      },
    ],
  },
  {
    slug: 'springs-and-sealing',
    name: 'Springs & Sealing',
    categories: [
      {
        slug: 'springs',
        name: 'Springs',
        families: [
          {
            slug: 'compression-springs',
            name: 'Compression Springs',
            description: 'Push back when compressed to cushion, return, or hold parts.',
            photo: 'a music-wire steel compression spring',
            presentationLabel: 'Material and Style',
            presentations: [
              {
                name: 'Music-Wire Steel',
                description: 'The strongest spring wire for general use.',
                photo: 'a bright music-wire steel compression spring',
              },
              {
                name: '302 Stainless Steel',
                description: 'Corrosion-resistant springs for wet areas.',
                photo: 'a stainless steel compression spring',
              },
              {
                name: '316 Stainless Steel',
                description: 'Extra corrosion resistance for marine use.',
                photo: 'a satin 316 stainless steel compression spring',
              },
              {
                name: 'Zinc-Plated Steel',
                description: 'Inexpensive springs with mild corrosion resistance.',
                photo: 'a zinc-plated steel compression spring',
              },
              {
                name: 'Squared and Ground',
                description: 'Flat ends stand straight and push evenly.',
                photo: 'a compression spring with flat ground ends standing upright',
              },
              {
                name: 'Conical',
                description: 'Collapse nearly flat to save space.',
                photo: 'a cone-shaped conical steel compression spring',
              },
              {
                name: 'Light-Duty Die',
                description: 'Rectangular wire for stamping dies.',
                photo: 'a blue light-duty die spring made from rectangular wire',
              },
              {
                name: 'Heavy-Duty Die',
                description: 'Handle the highest loads in dies and presses.',
                photo: 'a red heavy-duty die spring made from rectangular wire',
              },
              {
                name: 'Plastic',
                description: 'Nonmetallic springs that will not corrode.',
                photo: 'a white plastic compression spring',
              },
            ],
            specs: [
              { name: 'OD', values: [...inchRange(2, 16, 1), ...inchRange(20, 32, 4)] },
              { name: 'Length', values: [...inchRange(4, 32, 2), ...inchRange(36, 64, 4)] },
              {
                name: 'Wire Diameter',
                values: [
                  '0.010"',
                  '0.016"',
                  '0.022"',
                  '0.029"',
                  '0.035"',
                  '0.045"',
                  '0.055"',
                  '0.063"',
                ],
              },
            ],
            packQuantities: [1, 6, 12],
            basePrice: 0.55,
          },
        ],
      },
      {
        slug: 'o-rings',
        name: 'O-Rings',
        families: [
          {
            slug: 'o-rings',
            name: 'O-Rings',
            description: 'Seal static and moving joints against air, water, and oil.',
            photo: 'a few black rubber O-rings of different sizes',
            presentationLabel: 'Material',
            presentations: [
              {
                name: 'Buna-N',
                description: 'The most common O-ring for oil and fuel.',
                photo: 'a few black Buna-N rubber O-rings',
              },
              {
                name: 'Viton',
                description: 'Resists high temperatures and harsh chemicals.',
                photo: 'a few dark brown Viton fluoroelastomer O-rings',
              },
              {
                name: 'Silicone',
                description: 'Stays flexible from -80° to 450° F.',
                photo: 'a few translucent red silicone O-rings',
              },
              {
                name: 'EPDM',
                description: 'Ideal for water, steam, and brake fluid.',
                photo: 'a few matte black EPDM O-rings',
              },
              {
                name: 'PTFE',
                description: 'Chemically inert rings for aggressive fluids.',
                photo: 'a few white PTFE O-rings',
              },
              {
                name: 'Neoprene',
                description: 'Resists refrigerants and weathering.',
                photo: 'a few black neoprene O-rings with a slight sheen',
              },
              {
                name: 'FDA Silicone',
                description: 'Food-grade rings for food and beverage equipment.',
                photo: 'a few translucent white food-grade silicone O-rings',
              },
              {
                name: 'Polyurethane',
                description: 'Tough, abrasion-resistant rings for hydraulics.',
                photo: 'a few translucent amber polyurethane O-rings',
              },
              {
                name: 'Metal-Detectable Buna-N',
                description: 'Detectable by food-processing metal scanners.',
                photo: 'a few blue metal-detectable rubber O-rings',
              },
            ],
            specs: [
              {
                name: 'Cross Section',
                values: ['1/32"', '3/64"', '1/16"', '3/32"', '1/8"', '3/16"', '1/4"'],
              },
              {
                name: 'ID',
                values: [
                  ...inchRange(1, 32, 1),
                  ...inchRange(34, 96, 2),
                  ...inchRange(100, 192, 4),
                ],
              },
              { name: 'Durometer', values: ['50A', '60A', '70A', '80A', '90A'] },
            ],
            packQuantities: [10, 50, 100],
            basePrice: 0.14,
          },
        ],
      },
    ],
  },
]
