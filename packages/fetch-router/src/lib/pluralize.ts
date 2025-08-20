type InvariantPlurals =
  | 'sheep'
  | 'fish'
  | 'series'
  | 'species'
  | 'equipment'
  | 'information'
  | 'money'
  | 'news'

interface IrregularPlurals {
  person: 'people'
  man: 'men'
  woman: 'women'
  child: 'children'
  mouse: 'mice'
  goose: 'geese'
  foot: 'feet'
  tooth: 'teeth'
  ox: 'oxen'
  analysis: 'analyses'
  axis: 'axes'
  crisis: 'crises'
  thesis: 'theses'
  phenomenon: 'phenomena'
  criterion: 'criteria'
  datum: 'data'
  medium: 'media'
  index: 'indexes'
  matrix: 'matrices'
  quiz: 'quizzes'
}

type Vowel = 'a' | 'e' | 'i' | 'o' | 'u'
type OWord = 'hero' | 'potato' | 'tomato' | 'echo' | 'mosquito' | 'veto' | 'torpedo'

// prettier-ignore
export type Pluralize<S extends string> =
  Lowercase<S> extends InvariantPlurals ? S :
  Lowercase<S> extends keyof IrregularPlurals ? IrregularPlurals[Lowercase<S>] :
  Lowercase<S> extends `${string}${Vowel}y` ? `${S}s` :
  S extends `${infer L}y` ? `${L}ies` :
  Lowercase<S> extends `${string}${'s' | 'x' | 'z'}` ? `${S}es` :
  Lowercase<S> extends `${string}${'ch' | 'sh'}` ? `${S}es` :
  S extends `${infer L}fe` ? `${L}ves` :
  S extends `${infer L}f` ? `${L}ves` :
  Lowercase<S> extends OWord ? `${S}es` :
  `${S}s`

const invariantPlurals = new Set<InvariantPlurals>([
  'sheep',
  'fish',
  'series',
  'species',
  'equipment',
  'information',
  'money',
  'news',
])

const irregularPlurals: { [K in keyof IrregularPlurals]: IrregularPlurals[K] } = {
  person: 'people',
  man: 'men',
  woman: 'women',
  child: 'children',
  mouse: 'mice',
  goose: 'geese',
  foot: 'feet',
  tooth: 'teeth',
  ox: 'oxen',
  analysis: 'analyses',
  axis: 'axes',
  crisis: 'crises',
  thesis: 'theses',
  phenomenon: 'phenomena',
  criterion: 'criteria',
  datum: 'data',
  medium: 'media',
  index: 'indexes',
  matrix: 'matrices',
  quiz: 'quizzes',
}

const vowels = new Set<Vowel>(['a', 'e', 'i', 'o', 'u'])
const oWords = new Set<OWord>(['hero', 'potato', 'tomato', 'echo', 'mosquito', 'veto', 'torpedo'])

export function pluralize(singular: string): string {
  let lower = singular.toLowerCase()

  if (invariantPlurals.has(lower as InvariantPlurals)) return singular

  if (lower in irregularPlurals) {
    let plural = irregularPlurals[lower as keyof IrregularPlurals]
    // Preserve original casing for simple cases by replacing tail
    if (singular === lower) return plural
    return singular.slice(0, singular.length - lower.length) + plural
  }

  if (lower.endsWith('y') && !vowels.has(lower[lower.length - 2] as Vowel)) {
    return singular.slice(0, -1) + 'ies'
  }
  if (/(s|x|z)$/.test(lower) || /(ch|sh)$/.test(lower)) {
    return singular + 'es'
  }
  if (lower.endsWith('fe')) {
    return singular.slice(0, -2) + 'ves'
  }
  if (lower.endsWith('f')) {
    return singular.slice(0, -1) + 'ves'
  }
  if (oWords.has(lower as OWord)) {
    return singular + 'es'
  }

  if (lower.endsWith('s')) return singular // already plural or ends with s

  return singular + 's'
}
