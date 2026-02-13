type SplitPath<path extends string> = path extends ''
  ? []
  : path extends `${infer head}/${infer tail}`
    ? [head, ...SplitPath<tail>]
    : [path]

type Basename<path extends string> = path extends `${infer trimmed}/`
  ? Basename<trimmed>
  : path extends `${string}/${infer tail}`
    ? Basename<tail>
    : path

type ContainsSlash<text extends string> = text extends `${string}/${string}` ? true : false

export interface GlobMatchOptions {
  dot?: boolean
  nocase?: boolean
  noglobstar?: boolean
  noext?: boolean
  nobrace?: boolean
  matchBase?: boolean
}

type OptionEnabled<options extends GlobMatchOptions, key extends keyof GlobMatchOptions> =
  options extends Record<key, true> ? true : false

// AST -------------------------------------------------------------------------

type GlobPattern = {
  segments: SegmentPattern[]
}

type SegmentPattern = GlobStarSegment | SegmentTokens
type GlobStarSegment = { type: 'globstar' }
type SegmentTokens = { type: 'segment'; tokens: SegmentToken[] }

type SegmentToken = TextToken | WildcardToken | QMarkToken | ClassToken | ExtglobToken

type TextToken = { type: 'text'; value: string }
type WildcardToken = { type: 'wildcard' }
type QMarkToken = { type: 'qmark' }
type ClassToken = { type: 'class'; negated: boolean; body: string }
type ExtglobToken = {
  type: 'extglob'
  kind: '!' | '?' | '+' | '*' | '@'
  alternatives: SegmentTokens[]
}

// Brace expansion -------------------------------------------------------------

type BraceExpand<pattern extends string> = _BraceExpand<pattern>

type _BraceExpand<pattern extends string> =
  pattern extends `${infer prefix}{${infer body}}${infer suffix}`
    ? ExpandBraceBody<body> extends infer choice extends string
      ? _BraceExpand<`${prefix}${choice}${suffix}`>
      : never
    : pattern

type ExpandBraceBody<body extends string> =
  SplitByComma<body> extends infer choice extends string ? BraceChoiceExpand<choice> : never

type SplitByComma<text extends string> = text extends `${infer head},${infer tail}`
  ? head | SplitByComma<tail>
  : text

type BraceChoiceExpand<choice extends string> =
  choice extends `${infer a extends DigitChar}..${infer b extends DigitChar}`
    ? DigitRange<a, b>
    : choice extends `${infer a extends AlphaChar}..${infer b extends AlphaChar}`
      ? AlphaRange<a, b>
      : choice

type DigitChar = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type DigitIndexMap = {
  '0': []
  '1': [unknown]
  '2': [unknown, unknown]
  '3': [unknown, unknown, unknown]
  '4': [unknown, unknown, unknown, unknown]
  '5': [unknown, unknown, unknown, unknown, unknown]
  '6': [unknown, unknown, unknown, unknown, unknown, unknown]
  '7': [unknown, unknown, unknown, unknown, unknown, unknown, unknown]
  '8': [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]
  '9': [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]
}

type DigitByIndex<index extends number> = index extends 0
  ? '0'
  : index extends 1
    ? '1'
    : index extends 2
      ? '2'
      : index extends 3
        ? '3'
        : index extends 4
          ? '4'
          : index extends 5
            ? '5'
            : index extends 6
              ? '6'
              : index extends 7
                ? '7'
                : index extends 8
                  ? '8'
                  : index extends 9
                    ? '9'
                    : never

type DigitSuccMap = {
  '0': '1'
  '1': '2'
  '2': '3'
  '3': '4'
  '4': '5'
  '5': '6'
  '6': '7'
  '7': '8'
  '8': '9'
  '9': never
}

type DigitPrevMap = {
  '0': never
  '1': '0'
  '2': '1'
  '3': '2'
  '4': '3'
  '5': '4'
  '6': '5'
  '7': '6'
  '8': '7'
  '9': '8'
}

type IsDigitAscending<
  start extends DigitChar,
  end extends DigitChar,
  order extends DigitChar[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
> = order extends [infer head extends DigitChar, ...infer tail extends DigitChar[]]
  ? head extends start
    ? true
    : head extends end
      ? false
      : IsDigitAscending<start, end, tail>
  : true

type DigitRange<start extends DigitChar, end extends DigitChar> = start extends end
  ? start
  : IsDigitAscending<start, end> extends true
    ? CollectDigitRangeAscending<start, end>
    : CollectDigitRangeDescending<start, end>

type CollectDigitRangeAscending<
  current extends DigitChar,
  end extends DigitChar,
  result extends string = never,
> = current extends end
  ? [result] extends [never]
    ? current
    : result | current
  : DigitSuccMap[current] extends infer next extends DigitChar
    ? CollectDigitRangeAscending<next, end, [result] extends [never] ? current : result | current>
    : result

type CollectDigitRangeDescending<
  current extends DigitChar,
  end extends DigitChar,
  result extends string = never,
> = current extends end
  ? [result] extends [never]
    ? current
    : result | current
  : DigitPrevMap[current] extends infer next extends DigitChar
    ? CollectDigitRangeDescending<next, end, [result] extends [never] ? current : result | current>
    : result

type AlphaChar =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'

type AlphaIndexMap = {
  a: []
  b: [unknown]
  c: [unknown, unknown]
  d: [unknown, unknown, unknown]
  e: [unknown, unknown, unknown, unknown]
  f: [unknown, unknown, unknown, unknown, unknown]
  g: [unknown, unknown, unknown, unknown, unknown, unknown]
  h: [unknown, unknown, unknown, unknown, unknown, unknown, unknown]
  i: [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]
  j: [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]
  k: [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]
  l: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  m: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  n: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  o: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  p: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  q: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  r: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  s: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  t: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  u: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  v: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  w: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  x: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  y: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
  z: [
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ]
}

type AlphaRange<start extends AlphaChar, end extends AlphaChar> = start extends end
  ? start
  : IsAlphaAscending<start, end> extends true
    ? CollectAlphaRangeAscending<start, end>
    : CollectAlphaRangeDescending<start, end>

type AlphaSuccMap = {
  a: 'b'
  b: 'c'
  c: 'd'
  d: 'e'
  e: 'f'
  f: 'g'
  g: 'h'
  h: 'i'
  i: 'j'
  j: 'k'
  k: 'l'
  l: 'm'
  m: 'n'
  n: 'o'
  o: 'p'
  p: 'q'
  q: 'r'
  r: 's'
  s: 't'
  t: 'u'
  u: 'v'
  v: 'w'
  w: 'x'
  x: 'y'
  y: 'z'
  z: never
}

type AlphaPrevMap = {
  a: never
  b: 'a'
  c: 'b'
  d: 'c'
  e: 'd'
  f: 'e'
  g: 'f'
  h: 'g'
  i: 'h'
  j: 'i'
  k: 'j'
  l: 'k'
  m: 'l'
  n: 'm'
  o: 'n'
  p: 'o'
  q: 'p'
  r: 'q'
  s: 'r'
  t: 's'
  u: 't'
  v: 'u'
  w: 'v'
  x: 'w'
  y: 'x'
  z: 'y'
}

type IsAlphaAscending<
  start extends AlphaChar,
  end extends AlphaChar,
  order extends AlphaChar[] = [
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
  ],
> = order extends [infer head extends AlphaChar, ...infer tail extends AlphaChar[]]
  ? head extends start
    ? true
    : head extends end
      ? false
      : IsAlphaAscending<start, end, tail>
  : true

type CollectAlphaRangeAscending<
  current extends AlphaChar,
  end extends AlphaChar,
  result extends string = never,
> = current extends end
  ? [result] extends [never]
    ? current
    : result | current
  : AlphaSuccMap[current] extends infer next extends AlphaChar
    ? CollectAlphaRangeAscending<next, end, [result] extends [never] ? current : result | current>
    : result

type CollectAlphaRangeDescending<
  current extends AlphaChar,
  end extends AlphaChar,
  result extends string = never,
> = current extends end
  ? [result] extends [never]
    ? current
    : result | current
  : AlphaPrevMap[current] extends infer next extends AlphaChar
    ? CollectAlphaRangeDescending<next, end, [result] extends [never] ? current : result | current>
    : result

// Parser ----------------------------------------------------------------------

type NormalizeCase<text extends string, options extends GlobMatchOptions> =
  OptionEnabled<options, 'nocase'> extends true ? Lowercase<text> : text

type ParseGlobWithOptions<pattern extends string, options extends GlobMatchOptions> =
  OptionEnabled<options, 'nobrace'> extends true
    ? ParseExpandedGlob<NormalizeCase<pattern, options>, options>
    : ParseExpandedGlob<NormalizeCase<BraceExpand<pattern>, options>, options>

export type ParseGlob<pattern extends string> = ParseGlobWithOptions<pattern, {}>

type ParseExpandedGlob<
  pattern extends string,
  options extends GlobMatchOptions,
> = pattern extends pattern
  ? {
      segments: ParseSegments<pattern, options>
    }
  : never

type ParseSegments<
  text extends string,
  options extends GlobMatchOptions,
  current extends string = '',
  result extends SegmentPattern[] = [],
> = text extends `${infer head}${infer tail}`
  ? head extends '/'
    ? ParseSegments<tail, options, '', [...result, ParseSegment<current, options>]>
    : ParseSegments<tail, options, `${current}${head}`, result>
  : current extends ''
    ? result
    : [...result, ParseSegment<current, options>]

type ParseSegment<segment extends string, options extends GlobMatchOptions> = segment extends '**'
  ? OptionEnabled<options, 'noglobstar'> extends true
    ? { type: 'segment'; tokens: [{ type: 'wildcard' }] }
    : { type: 'globstar' }
  : { type: 'segment'; tokens: ParseTokenList<segment, options> }

type ParseTokenList<
  text extends string,
  options extends GlobMatchOptions,
  result extends SegmentToken[] = [],
> = text extends `${infer head}${infer tail}`
  ? head extends '\\'
    ? tail extends `${infer escaped}${infer rest}`
      ? ParseTokenList<rest, options, AppendTextToken<result, escaped>>
      : AppendTextToken<result, head>
    : OptionEnabled<options, 'noext'> extends true
      ? head extends '*'
        ? ParseTokenList<tail, options, [...result, { type: 'wildcard' }]>
        : head extends '?'
          ? ParseTokenList<tail, options, [...result, { type: 'qmark' }]>
          : head extends '['
            ? ParseClassToken<tail> extends {
                token: infer token extends ClassToken
                rest: infer rest extends string
              }
              ? ParseTokenList<rest, options, [...result, token]>
              : ParseTokenList<tail, options, AppendTextToken<result, '['>>
            : ParseTokenList<tail, options, AppendTextToken<result, head>>
      : head extends '!' | '?' | '+' | '*' | '@'
        ? tail extends `(${string}`
          ? ParseExtglob<`${head}${tail}`> extends {
              token: infer token extends ExtglobToken
              rest: infer rest extends string
            }
            ? ParseTokenList<rest, options, [...result, token]>
            : ParseTokenList<tail, options, AppendTextToken<result, head>>
          : head extends '*'
            ? ParseTokenList<tail, options, [...result, { type: 'wildcard' }]>
            : head extends '?'
              ? ParseTokenList<tail, options, [...result, { type: 'qmark' }]>
              : ParseTokenList<tail, options, AppendTextToken<result, head>>
        : head extends '*'
          ? ParseTokenList<tail, options, [...result, { type: 'wildcard' }]>
          : head extends '?'
            ? ParseTokenList<tail, options, [...result, { type: 'qmark' }]>
            : head extends '['
              ? ParseClassToken<tail> extends {
                  token: infer token extends ClassToken
                  rest: infer rest extends string
                }
                ? ParseTokenList<rest, options, [...result, token]>
                : ParseTokenList<tail, options, AppendTextToken<result, '['>>
              : ParseTokenList<tail, options, AppendTextToken<result, head>>
  : result

type AppendTextToken<tokens extends SegmentToken[], text extends string> = tokens extends [
  ...infer rest extends SegmentToken[],
  infer last extends SegmentToken,
]
  ? last extends { type: 'text'; value: infer value extends string }
    ? [...rest, { type: 'text'; value: `${value}${text}` }]
    : [...tokens, { type: 'text'; value: text }]
  : [{ type: 'text'; value: text }]

type ParseClassToken<text extends string> = _ParseClassToken<text, false, ''>

type HasOpenPosixClass<body extends string> = body extends `${string}[:${string}:` ? true : false

type _ParseClassToken<
  text extends string,
  negated extends boolean,
  body extends string,
  started extends boolean = false,
> = text extends `${infer head}${infer tail}`
  ? started extends false
    ? head extends '!' | '^'
      ? _ParseClassToken<tail, true, '', true>
      : head extends ']'
        ? _ParseClassToken<tail, negated, ']', true>
        : _ParseClassToken<tail, negated, `${body}${head}`, true>
    : head extends ']'
      ? HasOpenPosixClass<body> extends true
        ? _ParseClassToken<tail, negated, `${body}]`, true>
        : { token: { type: 'class'; negated: negated; body: body }; rest: tail }
      : _ParseClassToken<tail, negated, `${body}${head}`, true>
  : never

type ParseExtglob<text extends string> =
  text extends `${infer kind extends '!' | '?' | '+' | '*' | '@'}(${infer body}`
    ? ParseUntilGroupClose<body> extends {
        content: infer content extends string
        rest: infer rest extends string
      }
      ? {
          token: {
            type: 'extglob'
            kind: kind
            alternatives: ParseExtglobAlternatives<content>
          }
          rest: rest
        }
      : never
    : never

type ParseUntilGroupClose<
  text extends string,
  depth extends unknown[] = [],
  inClass extends boolean = false,
  result extends string = '',
> = text extends `${infer head}${infer tail}`
  ? head extends '\\'
    ? tail extends `${infer escaped}${infer tailRest}`
      ? ParseUntilGroupClose<tailRest, depth, inClass, `${result}${head}${escaped}`>
      : ParseUntilGroupClose<'', depth, inClass, `${result}${head}`>
    : inClass extends true
      ? head extends ']'
        ? ParseUntilGroupClose<tail, depth, false, `${result}]`>
        : ParseUntilGroupClose<tail, depth, true, `${result}${head}`>
      : head extends '['
        ? ParseUntilGroupClose<tail, depth, true, `${result}[`>
        : head extends '('
          ? ParseUntilGroupClose<tail, [...depth, unknown], false, `${result}(`>
          : head extends ')'
            ? depth extends [...infer pop, unknown]
              ? ParseUntilGroupClose<tail, pop, false, `${result})`>
              : { content: result; rest: tail }
            : ParseUntilGroupClose<tail, depth, false, `${result}${head}`>
  : never

type ParseExtglobAlternatives<text extends string> = MapAlternativeTokens<
  ParseAlternativesList<text>
>

type MapAlternativeTokens<alternatives extends string[]> = alternatives extends [
  infer head extends string,
  ...infer tail extends string[],
]
  ? [{ type: 'segment'; tokens: ParseTokenList<head, {}> }, ...MapAlternativeTokens<tail>]
  : []

type ParseAlternativesList<
  text extends string,
  depth extends unknown[] = [],
  inClass extends boolean = false,
  current extends string = '',
  result extends string[] = [],
> = text extends `${infer head}${infer tail}`
  ? head extends '\\'
    ? tail extends `${infer escaped}${infer tailRest}`
      ? ParseAlternativesList<tailRest, depth, inClass, `${current}${head}${escaped}`, result>
      : ParseAlternativesList<'', depth, inClass, `${current}${head}`, result>
    : inClass extends true
      ? head extends ']'
        ? ParseAlternativesList<tail, depth, false, `${current}]`, result>
        : ParseAlternativesList<tail, depth, true, `${current}${head}`, result>
      : head extends '['
        ? ParseAlternativesList<tail, depth, true, `${current}[`, result>
        : head extends '('
          ? ParseAlternativesList<tail, [...depth, unknown], false, `${current}(`, result>
          : head extends ')'
            ? depth extends [...infer pop, unknown]
              ? ParseAlternativesList<tail, pop, false, `${current})`, result>
              : never
            : head extends '|'
              ? depth extends []
                ? ParseAlternativesList<tail, depth, false, '', [...result, current]>
                : ParseAlternativesList<tail, depth, false, `${current}|`, result>
              : ParseAlternativesList<tail, depth, false, `${current}${head}`, result>
  : [...result, current]

// Matcher ---------------------------------------------------------------------

type MatchGlobParsed<
  path extends string,
  parsed extends GlobPattern,
  options extends GlobMatchOptions,
> = true extends (
  parsed extends parsed ? MatchSegments<SplitPath<path>, parsed['segments'], options> : never
)
  ? true
  : false

type SegmentStartsWithDot<tokens extends SegmentToken[]> = tokens extends [
  infer head extends SegmentToken,
  ...SegmentToken[],
]
  ? head extends { type: 'text'; value: infer value extends string }
    ? value extends `.${string}`
      ? true
      : false
    : false
  : false

type IsDotPathSegment<segment extends string> = segment extends '.' | '..' ? true : false

type IsHiddenPathSegment<segment extends string> = segment extends `.${string}` ? true : false

type CanGlobstarConsume<segment extends string, options extends GlobMatchOptions> =
  OptionEnabled<options, 'dot'> extends true
    ? IsDotPathSegment<segment> extends true
      ? false
      : true
    : IsHiddenPathSegment<segment> extends true
      ? false
      : true

type AllGlobstarConsumable<
  segments extends string[],
  options extends GlobMatchOptions,
> = segments extends [infer head extends string, ...infer tail extends string[]]
  ? CanGlobstarConsume<head, options> extends true
    ? AllGlobstarConsumable<tail, options>
    : false
  : true

type ShouldRejectLeadingDot<
  segment extends string,
  tokens extends SegmentToken[],
  options extends GlobMatchOptions,
> = segment extends `.${string}`
  ? OptionEnabled<options, 'dot'> extends true
    ? IsDotPathSegment<segment> extends true
      ? SegmentStartsWithDot<tokens> extends true
        ? false
        : true
      : false
    : SegmentStartsWithDot<tokens> extends true
      ? false
      : true
  : false

type MatchSegments<
  pathSegments extends string[],
  patternSegments extends SegmentPattern[],
  options extends GlobMatchOptions,
> = patternSegments extends [
  infer head extends SegmentPattern,
  ...infer tail extends SegmentPattern[],
]
  ? head extends { type: 'globstar' }
    ? tail extends []
      ? AllGlobstarConsumable<pathSegments, options>
      : MatchSegments<pathSegments, tail, options> extends true
        ? true
        : pathSegments extends [infer first extends string, ...infer rest extends string[]]
          ? CanGlobstarConsume<first, options> extends true
            ? MatchSegments<rest, patternSegments, options>
            : false
          : false
    : pathSegments extends [infer pathHead extends string, ...infer pathTail extends string[]]
      ? head extends { type: 'segment'; tokens: infer tokens extends SegmentToken[] }
        ? ShouldRejectLeadingDot<pathHead, tokens, options> extends true
          ? false
          : MatchSegmentString<pathHead, tokens> extends true
            ? MatchSegments<pathTail, tail, options>
            : false
        : false
      : false
  : pathSegments extends []
    ? true
    : false

type MatchSegmentString<segment extends string, tokens extends SegmentToken[]> = MatchTokenList<
  segment,
  tokens
>

type MatchTokenList<text extends string, tokens extends SegmentToken[]> = tokens extends [
  infer token extends SegmentToken,
  ...infer tail extends SegmentToken[],
]
  ? token extends { type: 'text'; value: infer value extends string }
    ? text extends `${value}${infer rest}`
      ? MatchTokenList<rest, tail>
      : false
    : token extends { type: 'qmark' }
      ? text extends `${infer _ch}${infer rest}`
        ? MatchTokenList<rest, tail>
        : false
      : token extends { type: 'wildcard' }
        ? MatchWildcardToken<text, tail>
        : token extends {
              type: 'class'
              negated: infer negated extends boolean
              body: infer body extends string
            }
          ? text extends `${infer ch}${infer rest}`
            ? MatchClassChar<ch, body, negated> extends true
              ? MatchTokenList<rest, tail>
              : false
            : false
          : token extends {
                type: 'extglob'
                kind: infer kind extends '!' | '?' | '+' | '*' | '@'
                alternatives: infer alternatives extends SegmentTokens[]
              }
            ? MatchExtglobToken<text, kind, alternatives, tail>
            : false
  : text extends ''
    ? true
    : false

type MatchWildcardToken<text extends string, tail extends SegmentToken[]> =
  MatchTokenList<text, tail> extends true
    ? true
    : text extends `${infer _ch}${infer rest}`
      ? MatchWildcardToken<rest, tail>
      : false

type MatchClassChar<
  char extends string,
  body extends string,
  negated extends boolean,
> = negated extends true
  ? CharInClass<char, body> extends true
    ? false
    : true
  : CharInClass<char, body>

type CharInClass<char extends string, body extends string> =
  ParseClassBody<body> extends infer items extends ClassItem[]
    ? ClassItemsContain<char, items>
    : false

type PosixClassName =
  | 'alnum'
  | 'alpha'
  | 'ascii'
  | 'blank'
  | 'cntrl'
  | 'digit'
  | 'graph'
  | 'lower'
  | 'print'
  | 'punct'
  | 'space'
  | 'upper'
  | 'word'
  | 'xdigit'

type ClassItem =
  | { type: 'char'; value: string }
  | { type: 'range'; start: string; end: string }
  | { type: 'posix'; name: PosixClassName }

type ParseClassBody<
  text extends string,
  result extends ClassItem[] = [],
> = text extends `[:${infer className extends PosixClassName}:]${infer rest}`
  ? ParseClassBody<rest, [...result, { type: 'posix'; name: className }]>
  : text extends `${infer a}${infer tail}`
    ? tail extends `-${infer b}${infer rest}`
      ? ParseClassBody<rest, [...result, { type: 'range'; start: a; end: b }]>
      : tail extends `${infer _next}${infer _remaining}`
        ? ParseClassBody<tail, [...result, { type: 'char'; value: a }]>
        : [...result, { type: 'char'; value: a }]
    : result

type ClassItemsContain<char extends string, items extends ClassItem[]> = items extends [
  infer head extends ClassItem,
  ...infer tail extends ClassItem[],
]
  ? head extends { type: 'char'; value: infer value extends string }
    ? [char] extends [value]
      ? true
      : ClassItemsContain<char, tail>
    : head extends { type: 'posix'; name: infer name extends PosixClassName }
      ? CharInPosixClass<char, name> extends true
        ? true
        : ClassItemsContain<char, tail>
      : head extends {
            type: 'range'
            start: infer start extends string
            end: infer end extends string
          }
        ? CharInRange<char, start, end> extends true
          ? true
          : ClassItemsContain<char, tail>
        : false
  : false

type HexLower = 'a' | 'b' | 'c' | 'd' | 'e' | 'f'
type HexUpper = Uppercase<HexLower>
type AlphaUpper = Uppercase<AlphaChar>
type AsciiPunct =
  | '!'
  | '"'
  | '#'
  | '$'
  | '%'
  | '&'
  | "'"
  | '('
  | ')'
  | '*'
  | '+'
  | ','
  | '-'
  | '.'
  | '/'
  | ':'
  | ';'
  | '<'
  | '='
  | '>'
  | '?'
  | '@'
  | '['
  | '\\'
  | ']'
  | '^'
  | '_'
  | '`'
  | '{'
  | '|'
  | '}'
  | '~'
type AsciiControl = '\t' | '\n' | '\r' | '\v' | '\f'
type AsciiPrintable = AlphaChar | AlphaUpper | DigitChar | AsciiPunct | ' '

type CharInPosixClass<
  char extends string,
  className extends PosixClassName,
> = className extends 'digit'
  ? char extends DigitChar
    ? true
    : false
  : className extends 'lower'
    ? char extends AlphaChar
      ? true
      : false
    : className extends 'upper'
      ? char extends AlphaUpper
        ? true
        : false
      : className extends 'alpha'
        ? char extends AlphaChar | AlphaUpper
          ? true
          : false
        : className extends 'alnum'
          ? char extends AlphaChar | AlphaUpper | DigitChar
            ? true
            : false
          : className extends 'xdigit'
            ? char extends DigitChar | HexLower | HexUpper
              ? true
              : false
            : className extends 'word'
              ? char extends AlphaChar | AlphaUpper | DigitChar | '_'
                ? true
                : false
              : className extends 'blank'
                ? char extends ' ' | '\t'
                  ? true
                  : false
                : className extends 'space'
                  ? char extends ' ' | '\t' | '\n' | '\r' | '\v' | '\f'
                    ? true
                    : false
                  : className extends 'punct'
                    ? char extends AsciiPunct
                      ? true
                      : false
                    : className extends 'cntrl'
                      ? char extends AsciiControl
                        ? true
                        : false
                      : className extends 'print'
                        ? char extends AsciiPrintable
                          ? true
                          : false
                        : className extends 'graph'
                          ? char extends Exclude<AsciiPrintable, ' '>
                            ? true
                            : false
                          : className extends 'ascii'
                            ? char extends AsciiPrintable | AsciiControl
                              ? true
                              : false
                            : false

type CharInRange<
  char extends string,
  start extends string,
  end extends string,
> = start extends AlphaChar
  ? end extends AlphaChar
    ? char extends AlphaChar
      ? AlphaWithin<char, start, end>
      : false
    : false
  : start extends `${infer a extends number}`
    ? end extends `${infer b extends number}`
      ? char extends `${infer c extends number}`
        ? NumberWithin<c, a, b>
        : false
      : false
    : false

type AlphaWithin<char extends AlphaChar, start extends AlphaChar, end extends AlphaChar> =
  Gte<AlphaIndexMap[char]['length'], AlphaIndexMap[start]['length']> extends true
    ? Lte<AlphaIndexMap[char]['length'], AlphaIndexMap[end]['length']>
    : false

type NumberWithin<value extends number, start extends number, end extends number> =
  Gte<value, start> extends true ? Lte<value, end> : false

type Gte<a extends number, b extends number, i extends unknown[] = []> = i['length'] extends a
  ? i['length'] extends b
    ? true
    : false
  : i['length'] extends b
    ? true
    : Gte<a, b, [...i, unknown]>

type Lte<a extends number, b extends number, i extends unknown[] = []> = i['length'] extends a
  ? true
  : i['length'] extends b
    ? false
    : Lte<a, b, [...i, unknown]>

type MatchExtglobToken<
  text extends string,
  kind extends '!' | '?' | '+' | '*' | '@',
  alternatives extends SegmentTokens[],
  tail extends SegmentToken[],
> = kind extends '@'
  ? MatchExtglobAtLeastOne<text, alternatives, tail, false>
  : kind extends '?'
    ? MatchTokenList<text, tail> extends true
      ? true
      : MatchExtglobAtLeastOne<text, alternatives, tail, false>
    : kind extends '+'
      ? MatchExtglobAtLeastOne<text, alternatives, tail, true>
      : kind extends '*'
        ? MatchTokenList<text, tail> extends true
          ? true
          : MatchExtglobAtLeastOne<text, alternatives, tail, true>
        : MatchExtglobNegated<text, alternatives, tail>

type MatchExtglobAtLeastOne<
  text extends string,
  alternatives extends SegmentTokens[],
  tail extends SegmentToken[],
  repeat extends boolean,
> = alternatives extends [infer alt extends SegmentTokens, ...infer rest extends SegmentTokens[]]
  ? IsNever<ConsumeSegmentPrefix<text, alt['tokens']>> extends true
    ? MatchExtglobAtLeastOne<text, rest, tail, repeat>
    : ConsumeSegmentPrefix<text, alt['tokens']> extends infer remainder extends string
      ? repeat extends true
        ? MatchTokenList<remainder, tail> extends true
          ? true
          : MatchExtglobAtLeastOne<remainder, alternatives, tail, true> extends true
            ? true
            : MatchExtglobAtLeastOne<text, rest, tail, repeat>
        : MatchTokenList<remainder, tail> extends true
          ? true
          : MatchExtglobAtLeastOne<text, rest, tail, repeat>
      : false
  : false

type ConsumeSegmentPrefix<text extends string, tokens extends SegmentToken[]> = ConsumePrefix<
  text,
  tokens
>

type ConsumePrefix<text extends string, tokens extends SegmentToken[]> = tokens extends [
  infer token extends SegmentToken,
  ...infer tail extends SegmentToken[],
]
  ? token extends { type: 'text'; value: infer value extends string }
    ? text extends `${value}${infer rest}`
      ? ConsumePrefix<rest, tail>
      : never
    : token extends { type: 'qmark' }
      ? text extends `${infer _ch}${infer rest}`
        ? ConsumePrefix<rest, tail>
        : never
      : token extends { type: 'wildcard' }
        ? ConsumePrefixWithWildcard<text, tail>
        : token extends {
              type: 'class'
              negated: infer negated extends boolean
              body: infer body extends string
            }
          ? text extends `${infer ch}${infer rest}`
            ? MatchClassChar<ch, body, negated> extends true
              ? ConsumePrefix<rest, tail>
              : never
            : never
          : token extends {
                type: 'extglob'
                kind: infer kind extends '!' | '?' | '+' | '*' | '@'
                alternatives: infer alternatives extends SegmentTokens[]
              }
            ? ConsumePrefixExtglob<text, kind, alternatives, tail>
            : never
  : text

type ConsumePrefixWithWildcard<text extends string, tail extends SegmentToken[]> =
  ConsumePrefix<text, tail> extends infer remainder extends string
    ? remainder
    : text extends `${infer _ch}${infer rest}`
      ? ConsumePrefixWithWildcard<rest, tail>
      : never

type ConsumePrefixExtglob<
  text extends string,
  kind extends '!' | '?' | '+' | '*' | '@',
  alternatives extends SegmentTokens[],
  tail extends SegmentToken[],
> = kind extends '@'
  ? ConsumeWithAlternatives<text, alternatives, tail, false, true>
  : kind extends '?'
    ? ConsumePrefix<text, tail> extends infer zero extends string
      ? zero | ConsumeWithAlternatives<text, alternatives, tail, false, true>
      : ConsumeWithAlternatives<text, alternatives, tail, false, true>
    : kind extends '+'
      ? ConsumeWithAlternatives<text, alternatives, tail, true, true>
      : kind extends '*'
        ? ConsumePrefix<text, tail> extends infer zero extends string
          ? zero | ConsumeWithAlternatives<text, alternatives, tail, true, true>
          : ConsumeWithAlternatives<text, alternatives, tail, true, true>
        : never

type ConsumeWithAlternatives<
  text extends string,
  alternatives extends SegmentTokens[],
  tail extends SegmentToken[],
  repeat extends boolean,
  requireOne extends boolean,
> = alternatives extends [infer alt extends SegmentTokens, ...infer rest extends SegmentTokens[]]
  ? IsNever<ConsumePrefix<text, alt['tokens']>> extends true
    ? ConsumeWithAlternatives<text, rest, tail, repeat, requireOne>
    : ConsumePrefix<text, alt['tokens']> extends infer remainder extends string
      ? repeat extends true
        ? ConsumePrefix<remainder, tail> extends infer done extends string
          ?
              | done
              | ConsumeWithAlternatives<remainder, alternatives, tail, true, false>
              | ConsumeWithAlternatives<text, rest, tail, repeat, requireOne>
          :
              | ConsumeWithAlternatives<remainder, alternatives, tail, true, false>
              | ConsumeWithAlternatives<text, rest, tail, repeat, requireOne>
        : ConsumePrefix<remainder, tail> extends infer done extends string
          ? done | ConsumeWithAlternatives<text, rest, tail, repeat, requireOne>
          : ConsumeWithAlternatives<text, rest, tail, repeat, requireOne>
      : never
  : requireOne extends true
    ? never
    : never

type MatchExtglobNegated<
  text extends string,
  alternatives extends SegmentTokens[],
  tail extends SegmentToken[],
  prefix extends string = '',
> =
  MatchTokenList<text, tail> extends true
    ? AnyAlternativeMatches<prefix, alternatives> extends true
      ? false
      : true
    : text extends `${infer head}${infer rest}`
      ? MatchExtglobNegated<rest, alternatives, tail, `${prefix}${head}`>
      : false

type AnyAlternativeMatches<
  text extends string,
  alternatives extends SegmentTokens[],
> = alternatives extends [infer alt extends SegmentTokens, ...infer rest extends SegmentTokens[]]
  ? MatchSegmentString<text, alt['tokens']> extends true
    ? true
    : AnyAlternativeMatches<text, rest>
  : false

type IsNever<value> = [value] extends [never] ? true : false

// Public API ------------------------------------------------------------------

type MatchPathForPattern<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions,
> =
  OptionEnabled<options, 'matchBase'> extends true
    ? ContainsSlash<NormalizeCase<pattern, options>> extends true
      ? path
      : Basename<path>
    : path

type MatchWithOptions<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions,
> = MatchGlobParsed<
  NormalizeCase<MatchPathForPattern<path, pattern, options>, options>,
  ParseGlobWithOptions<pattern, options>,
  options
>

export type MatchGlob<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions = {},
> = true extends (pattern extends pattern ? MatchWithOptions<path, pattern, options> : never)
  ? true
  : false

export type MatchedPatterns<
  path extends string,
  patterns extends string,
  options extends GlobMatchOptions = {},
> = patterns extends patterns
  ? MatchGlob<path, patterns, options> extends true
    ? patterns
    : never
  : never
