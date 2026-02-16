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

type ForceDistributive = any

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

type BraceChoiceExpand<choice extends string> = choice extends `${string}..${string}`
  ? BraceRangeChoiceExpand<choice>
  : choice

type BraceRangeChoiceExpand<choice extends string> =
  choice extends `${infer a extends DigitChar}..${infer b extends DigitChar}`
    ? DigitRange<a, b>
    : choice extends `${infer a extends AlphaChar}..${infer b extends AlphaChar}`
      ? AlphaRange<a, b>
      : choice extends `${infer a extends AlphaUpperChar}..${infer b extends AlphaUpperChar}`
        ? Uppercase<AlphaRange<NormalizeAlphaRangeChar<a>, NormalizeAlphaRangeChar<b>>>
        : choice extends `${infer a}..${infer b}`
          ? NumericStringRange<a, b> extends infer numericRange extends string
            ? [numericRange] extends [never]
              ? choice
              : numericRange
            : choice
          : choice

type ParseNonNegativeInteger<text extends string> = text extends `${infer n extends number}`
  ? `${n}` extends text
    ? text extends `-${string}`
      ? never
      : n
    : never
  : never

type BuildTuple<
  length extends number,
  result extends unknown[] = [],
> = result['length'] extends length ? result : BuildTuple<length, [...result, unknown]>

type Increment<numberValue extends number> = [...BuildTuple<numberValue>, unknown]['length']

type Decrement<numberValue extends number> =
  BuildTuple<numberValue> extends [...infer rest extends unknown[], unknown]
    ? rest['length']
    : never

type IsNumberLessThanOrEqual<left extends number, right extends number> =
  BuildTuple<right> extends [...BuildTuple<left>, ...infer _rest extends unknown[]] ? true : false

type CollectNumberRangeAscending<
  current extends number,
  end extends number,
  result extends string = never,
> = current extends end
  ? [result] extends [never]
    ? `${current}`
    : result | `${current}`
  : Increment<current> extends infer next extends number
    ? CollectNumberRangeAscending<
        next,
        end,
        [result] extends [never] ? `${current}` : result | `${current}`
      >
    : never

type CollectNumberRangeDescending<
  current extends number,
  end extends number,
  result extends string = never,
> = current extends end
  ? [result] extends [never]
    ? `${current}`
    : result | `${current}`
  : Decrement<current> extends infer next extends number
    ? CollectNumberRangeDescending<
        next,
        end,
        [result] extends [never] ? `${current}` : result | `${current}`
      >
    : never

type NumericStringRange<start extends string, end extends string> =
  ParseNonNegativeInteger<start> extends infer startNumber extends number
    ? ParseNonNegativeInteger<end> extends infer endNumber extends number
      ? IsNumberLessThanOrEqual<startNumber, endNumber> extends true
        ? CollectNumberRangeAscending<startNumber, endNumber>
        : CollectNumberRangeDescending<startNumber, endNumber>
      : never
    : never

type AlphaUpperChar = Uppercase<AlphaChar>

type NormalizeAlphaRangeChar<char extends AlphaChar | AlphaUpperChar> =
  Lowercase<char> extends infer lower extends AlphaChar ? lower : never

type DigitChar = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

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

type NormalizePatternWithOptions<pattern extends string, options extends GlobMatchOptions> =
  OptionEnabled<options, 'nobrace'> extends true
    ? NormalizeCase<pattern, options>
    : pattern extends `${string}{${string}`
      ? NormalizeCase<BraceExpand<pattern>, options>
      : NormalizeCase<pattern, options>

type ParseGlobWithOptions<pattern extends string, options extends GlobMatchOptions> =
  NormalizePatternWithOptions<pattern, options> extends infer normalized extends string
    ? ParseExpandedGlob<normalized, options>
    : never

export type ParseGlob<pattern extends string> = pattern extends ForceDistributive
  ? ParseGlobWithOptions<pattern, {}>
  : never

type ParseExpandedGlob<
  pattern extends string,
  options extends GlobMatchOptions,
> = pattern extends ForceDistributive
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
> = depth extends []
  ? inClass extends false
    ? result extends ''
      ? text extends `${infer content})${infer rest}`
        ? IsSimpleGroupContent<content> extends true
          ? { content: content; rest: rest }
          : ParseUntilGroupCloseComplex<text, depth, inClass, result>
        : ParseUntilGroupCloseComplex<text, depth, inClass, result>
      : ParseUntilGroupCloseComplex<text, depth, inClass, result>
    : ParseUntilGroupCloseComplex<text, depth, inClass, result>
  : ParseUntilGroupCloseComplex<text, depth, inClass, result>

type IsSimpleGroupContent<text extends string> =
  text extends `${string}${'\\' | '[' | '(' | ')'}${string}` ? false : true

type ParseUntilGroupCloseComplex<
  text extends string,
  depth extends unknown[] = [],
  inClass extends boolean = false,
  result extends string = '',
> = text extends `${infer head}${infer tail}`
  ? head extends '\\'
    ? tail extends `${infer escaped}${infer tailRest}`
      ? ParseUntilGroupCloseComplex<tailRest, depth, inClass, `${result}${head}${escaped}`>
      : ParseUntilGroupCloseComplex<'', depth, inClass, `${result}${head}`>
    : inClass extends true
      ? head extends ']'
        ? ParseUntilGroupCloseComplex<tail, depth, false, `${result}]`>
        : ParseUntilGroupCloseComplex<tail, depth, true, `${result}${head}`>
      : head extends '['
        ? ParseUntilGroupCloseComplex<tail, depth, true, `${result}[`>
        : head extends '('
          ? ParseUntilGroupCloseComplex<tail, [...depth, unknown], false, `${result}(`>
          : head extends ')'
            ? depth extends [...infer pop, unknown]
              ? ParseUntilGroupCloseComplex<tail, pop, false, `${result})`>
              : { content: result; rest: tail }
            : ParseUntilGroupCloseComplex<tail, depth, false, `${result}${head}`>
  : never

type ParseExtglobAlternatives<text extends string> = MapAlternativeTokens<
  IsSimpleExtglobBody<text> extends true ? SplitByPipe<text> : ParseAlternativesList<text>
>

type IsSimpleExtglobBody<body extends string> =
  body extends `${string}${'\\' | '[' | '(' | ')'}${string}` ? false : true

type SplitByPipe<text extends string> = text extends `${infer head}|${infer tail}`
  ? [head, ...SplitByPipe<tail>]
  : [text]

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

type BasicToken = TextToken | WildcardToken | QMarkToken
type BasicSegmentPattern = GlobStarSegment | { type: 'segment'; tokens: BasicToken[] }

type HasExtglobSyntax<text extends string, options extends GlobMatchOptions> =
  OptionEnabled<options, 'noext'> extends true
    ? false
    : text extends `${string}${'!' | '?' | '+' | '*' | '@'}(${string}`
      ? true
      : false

type HasAdvancedSyntax<
  text extends string,
  options extends GlobMatchOptions,
> = text extends `${string}[${string}`
  ? true
  : text extends `${string}\\${string}`
    ? true
    : HasExtglobSyntax<text, options>

type HasStarOnlySyntax<text extends string, options extends GlobMatchOptions> =
  HasAdvancedSyntax<text, options> extends true
    ? false
    : text extends `${string}?${string}`
      ? false
      : true

type InferMatchEngine<pattern extends string, options extends GlobMatchOptions> =
  HasAdvancedSyntax<pattern, options> extends true
    ? 'advanced'
    : HasStarOnlySyntax<pattern, options> extends true
      ? 'star'
      : 'basic'

type ParseBasicGlob<
  pattern extends string,
  options extends GlobMatchOptions,
> = pattern extends ForceDistributive
  ? {
      segments: ParseBasicSegments<pattern, options>
    }
  : never

type ParseBasicSegments<
  text extends string,
  options extends GlobMatchOptions,
  current extends string = '',
  result extends BasicSegmentPattern[] = [],
> = text extends `${infer head}${infer tail}`
  ? head extends '/'
    ? ParseBasicSegments<tail, options, '', [...result, ParseBasicSegment<current, options>]>
    : ParseBasicSegments<tail, options, `${current}${head}`, result>
  : current extends ''
    ? result
    : [...result, ParseBasicSegment<current, options>]

type ParseBasicSegment<
  segment extends string,
  options extends GlobMatchOptions,
> = segment extends '**'
  ? OptionEnabled<options, 'noglobstar'> extends true
    ? { type: 'segment'; tokens: [{ type: 'wildcard' }] }
    : { type: 'globstar' }
  : { type: 'segment'; tokens: ParseBasicTokenList<segment> }

type ParseBasicTokenList<
  text extends string,
  result extends BasicToken[] = [],
> = text extends `${infer head}${infer tail}`
  ? head extends '*'
    ? ParseBasicTokenList<tail, [...result, { type: 'wildcard' }]>
    : head extends '?'
      ? ParseBasicTokenList<tail, [...result, { type: 'qmark' }]>
      : ParseBasicTokenList<tail, AppendBasicTextToken<result, head>>
  : result

type AppendBasicTextToken<tokens extends BasicToken[], text extends string> = tokens extends [
  ...infer rest extends BasicToken[],
  infer last extends BasicToken,
]
  ? last extends { type: 'text'; value: infer value extends string }
    ? [...rest, { type: 'text'; value: `${value}${text}` }]
    : [...tokens, { type: 'text'; value: text }]
  : [{ type: 'text'; value: text }]

type MatchBasicGlobParsed<
  path extends string,
  parsed extends { segments: BasicSegmentPattern[] },
  options extends GlobMatchOptions,
> = true extends (
  parsed extends parsed ? MatchBasicSegments<SplitPath<path>, parsed['segments'], options> : never
)
  ? true
  : false

type MatchBasicSegments<
  pathSegments extends string[],
  patternSegments extends BasicSegmentPattern[],
  options extends GlobMatchOptions,
> = patternSegments extends [
  infer head extends BasicSegmentPattern,
  ...infer tail extends BasicSegmentPattern[],
]
  ? head extends { type: 'globstar' }
    ? tail extends []
      ? AllGlobstarConsumable<pathSegments, options>
      : MatchBasicSegments<pathSegments, tail, options> extends true
        ? true
        : pathSegments extends [infer first extends string, ...infer rest extends string[]]
          ? CanGlobstarConsume<first, options> extends true
            ? MatchBasicSegments<rest, patternSegments, options>
            : false
          : false
    : pathSegments extends [infer pathHead extends string, ...infer pathTail extends string[]]
      ? head extends { type: 'segment'; tokens: infer tokens extends BasicToken[] }
        ? ShouldRejectLeadingDot<pathHead, tokens, options> extends true
          ? false
          : MatchBasicTokenList<pathHead, tokens> extends true
            ? MatchBasicSegments<pathTail, tail, options>
            : false
        : false
      : false
  : pathSegments extends []
    ? true
    : false

type MatchBasicTokenList<text extends string, tokens extends BasicToken[]> = tokens extends [
  infer token extends BasicToken,
  ...infer tail extends BasicToken[],
]
  ? token extends { type: 'text'; value: infer value extends string }
    ? text extends `${value}${infer rest}`
      ? MatchBasicTokenList<rest, tail>
      : false
    : token extends { type: 'qmark' }
      ? text extends `${infer _ch}${infer rest}`
        ? MatchBasicTokenList<rest, tail>
        : false
      : MatchBasicWildcardToken<text, tail>
  : text extends ''
    ? true
    : false

type MatchBasicWildcardToken<text extends string, tail extends BasicToken[]> =
  MatchBasicTokenList<text, tail> extends true
    ? true
    : text extends `${infer _ch}${infer rest}`
      ? MatchBasicWildcardToken<rest, tail>
      : false

type MatchBasicPath<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions,
> = MatchBasicPathSegments<SplitPath<path>, SplitPath<pattern>, options>

type MatchBasicPathSegments<
  pathSegments extends string[],
  patternSegments extends string[],
  options extends GlobMatchOptions,
> = patternSegments extends [infer head extends string, ...infer tail extends string[]]
  ? head extends '**'
    ? OptionEnabled<options, 'noglobstar'> extends true
      ? pathSegments extends [infer pathHead extends string, ...infer pathTail extends string[]]
        ? ShouldRejectLeadingDotForPattern<pathHead, '*', options> extends true
          ? false
          : MatchBasicSegmentString<pathHead, '*'> extends true
            ? MatchBasicPathSegments<pathTail, tail, options>
            : false
        : false
      : tail extends []
        ? AllGlobstarConsumable<pathSegments, options>
        : MatchBasicPathSegments<pathSegments, tail, options> extends true
          ? true
          : pathSegments extends [infer first extends string, ...infer rest extends string[]]
            ? CanGlobstarConsume<first, options> extends true
              ? MatchBasicPathSegments<rest, patternSegments, options>
              : false
            : false
    : pathSegments extends [infer pathHead extends string, ...infer pathTail extends string[]]
      ? ShouldRejectLeadingDotForPattern<pathHead, head, options> extends true
        ? false
        : MatchBasicSegmentString<pathHead, head> extends true
          ? MatchBasicPathSegments<pathTail, tail, options>
          : false
      : false
  : pathSegments extends []
    ? true
    : false

type MatchBasicSegmentString<
  text extends string,
  pattern extends string,
> = pattern extends `${infer head}${infer tail}`
  ? head extends '*'
    ? MatchBasicStar<text, tail>
    : head extends '?'
      ? text extends `${infer _ch}${infer rest}`
        ? MatchBasicSegmentString<rest, tail>
        : false
      : text extends `${head}${infer rest}`
        ? MatchBasicSegmentString<rest, tail>
        : false
  : text extends ''
    ? true
    : false

type MatchBasicStar<text extends string, tail extends string> =
  MatchBasicSegmentString<text, tail> extends true
    ? true
    : text extends `${infer _ch}${infer rest}`
      ? MatchBasicStar<rest, tail>
      : false

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

type AllGlobstarConsumablePath<
  path extends string,
  options extends GlobMatchOptions,
> = path extends ''
  ? true
  : path extends `${infer head}/${infer tail}`
    ? CanGlobstarConsume<head, options> extends true
      ? AllGlobstarConsumablePath<tail, options>
      : false
    : CanGlobstarConsume<path, options>

type SplitAtLastSlash<path extends string> = path extends `${infer head}/${infer tail}`
  ? SplitAtLastSlash<tail> extends {
      middle: infer middle extends string
      basename: infer basename extends string
    }
    ? {
        middle: middle extends '' ? head : `${head}/${middle}`
        basename: basename
      }
    : never
  : { middle: ''; basename: path }

type MatchStarOnlyMiddleGlobstarPathSlow<
  tail extends string,
  segmentPattern extends string,
  options extends GlobMatchOptions,
> =
  SplitAtLastSlash<tail> extends {
    middle: infer middle extends string
    basename: infer basename extends string
  }
    ? middle extends ''
      ? MatchStarOnlyDotSafeSegment<basename, segmentPattern, options>
      : AllGlobstarConsumablePath<middle, options> extends true
        ? MatchStarOnlyDotSafeSegment<basename, segmentPattern, options>
        : false
    : false

type MatchStarOnlyGlobstarSuffixPathSlow<
  path extends string,
  segmentPattern extends string,
  options extends GlobMatchOptions,
> =
  SplitAtLastSlash<path> extends {
    middle: infer middle extends string
    basename: infer basename extends string
  }
    ? middle extends ''
      ? MatchStarOnlyDotSafeSegment<basename, segmentPattern, options>
      : AllGlobstarConsumablePath<middle, options> extends true
        ? MatchStarOnlyDotSafeSegment<basename, segmentPattern, options>
        : false
    : false

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

type ShouldRejectLeadingDotForPattern<
  segment extends string,
  patternSegment extends string,
  options extends GlobMatchOptions,
> = segment extends `.${string}`
  ? OptionEnabled<options, 'dot'> extends true
    ? IsDotPathSegment<segment> extends true
      ? patternSegment extends `.${string}`
        ? false
        : true
      : false
    : patternSegment extends `.${string}`
      ? false
      : true
  : false

type MatchStarOnlySegment<
  text extends string,
  pattern extends string,
> = pattern extends `${infer prefix}*${infer suffix}`
  ? text extends `${prefix}${infer rest}`
    ? MatchStarOnlyAfterPrefixMatch<text, rest, suffix>
    : false
  : text extends pattern
    ? true
    : false

type MatchStarOnlyAfterPrefixMatch<
  fullText extends string,
  textAfterPrefix extends string,
  suffix extends string,
> = suffix extends ''
  ? true
  : suffix extends `${string}*${string}`
    ? MatchStarOnlyAfterStar<textAfterPrefix, suffix>
    : fullText extends `${string}${suffix}`
      ? true
      : false

type MatchStarOnlyAfterStar<text extends string, suffix extends string> = suffix extends ''
  ? true
  : MatchStarOnlySegment<text, suffix> extends true
    ? true
    : text extends `${infer _head}${infer tail}`
      ? MatchStarOnlyAfterStar<tail, suffix>
      : false

type MatchStarOnlyTrailingGlobstarPath<
  path extends string,
  prefix extends string,
  options extends GlobMatchOptions,
> = [path] extends [prefix]
  ? true
  : path extends `${prefix}/${infer tail}`
    ? AllGlobstarConsumablePath<tail, options>
    : false

type MatchStarOnlyMiddleGlobstarPath<
  path extends string,
  prefix extends string,
  segmentPattern extends string,
  options extends GlobMatchOptions,
> = path extends `${prefix}/${infer tail}`
  ? tail extends `${infer middle}/${infer basename}`
    ? ContainsSlash<basename> extends true
      ? MatchStarOnlyMiddleGlobstarPathSlow<tail, segmentPattern, options>
      : AllGlobstarConsumablePath<middle, options> extends true
        ? MatchStarOnlyDotSafeSegment<basename, segmentPattern, options>
        : false
    : MatchStarOnlyDotSafeSegment<tail, segmentPattern, options>
  : false

type MatchStarOnlyGlobstarSuffixPath<
  path extends string,
  segmentPattern extends string,
  options extends GlobMatchOptions,
> = path extends `${infer prefix}/${infer basename}`
  ? ContainsSlash<basename> extends true
    ? MatchStarOnlyGlobstarSuffixPathSlow<path, segmentPattern, options>
    : AllGlobstarConsumablePath<prefix, options> extends true
      ? MatchStarOnlyDotSafeSegment<basename, segmentPattern, options>
      : false
  : MatchStarOnlyDotSafeSegment<path, segmentPattern, options>

type MatchStarOnlyFastSegment<
  segment extends string,
  pattern extends string,
> = pattern extends `*${infer suffix}`
  ? suffix extends `${string}*${string}`
    ? MatchStarOnlySegment<segment, pattern>
    : segment extends `${string}${suffix}`
      ? true
      : false
  : MatchStarOnlySegment<segment, pattern>

type MatchStarOnlyDotSafeSegment<
  segment extends string,
  patternSegment extends string,
  options extends GlobMatchOptions,
> =
  ShouldRejectLeadingDotForPattern<segment, patternSegment, options> extends true
    ? false
    : MatchStarOnlyFastSegment<segment, patternSegment>

type MatchStarOnlySingleSegmentPath<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions,
> = pattern extends `${infer dir}/*${infer segmentSuffix}`
  ? dir extends `${string}*${string}`
    ? never
    : ContainsSlash<segmentSuffix> extends true
      ? never
      : segmentSuffix extends `${string}*${string}`
        ? never
        : path extends `${dir}/${string}/${string}`
          ? false
          : path extends `${dir}/${infer basename}`
            ? MatchStarOnlyDotSafeSegment<basename, `*${segmentSuffix}`, options>
            : false
  : never

type MatchStarOnlyFallback<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions,
> = MatchStarOnlySegments<SplitPath<path>, SplitPath<pattern>, options>

type MatchStarOnlyGlobstarPattern<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions,
> = pattern extends `${infer prefix}/**/${infer segmentPattern}`
  ? prefix extends `${string}*${string}`
    ? MatchStarOnlyFallback<path, pattern, options>
    : ContainsSlash<segmentPattern> extends true
      ? MatchStarOnlyFallback<path, pattern, options>
      : MatchStarOnlyMiddleGlobstarPath<path, prefix, segmentPattern, options>
  : pattern extends `${infer prefix}/**`
    ? prefix extends `${string}*${string}`
      ? MatchStarOnlyFallback<path, pattern, options>
      : MatchStarOnlyTrailingGlobstarPath<path, prefix, options>
    : pattern extends `**/${infer segmentPattern}`
      ? ContainsSlash<segmentPattern> extends true
        ? MatchStarOnlyFallback<path, pattern, options>
        : MatchStarOnlyGlobstarSuffixPath<path, segmentPattern, options>
      : MatchStarOnlyFallback<path, pattern, options>

type MatchStarOnlyPath<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions,
> =
  OptionEnabled<options, 'noglobstar'> extends true
    ? MatchStarOnlyFallback<path, pattern, options>
    : pattern extends `${string}**${string}`
      ? MatchStarOnlyGlobstarPattern<path, pattern, options>
      : MatchStarOnlySingleSegmentPath<path, pattern, options> extends infer singleSegmentMatch
        ? [singleSegmentMatch] extends [never]
          ? MatchStarOnlyFallback<path, pattern, options>
          : singleSegmentMatch
        : false

type MatchStarOnlySegments<
  pathSegments extends string[],
  patternSegments extends string[],
  options extends GlobMatchOptions,
> = patternSegments extends [infer head extends string, ...infer tail extends string[]]
  ? head extends '**'
    ? OptionEnabled<options, 'noglobstar'> extends true
      ? pathSegments extends [infer pathHead extends string, ...infer pathTail extends string[]]
        ? ShouldRejectLeadingDotForPattern<pathHead, '*', options> extends true
          ? false
          : MatchStarOnlySegment<pathHead, '*'> extends true
            ? MatchStarOnlySegments<pathTail, tail, options>
            : false
        : false
      : tail extends []
        ? AllGlobstarConsumable<pathSegments, options>
        : MatchStarOnlySegments<pathSegments, tail, options> extends true
          ? true
          : pathSegments extends [infer first extends string, ...infer rest extends string[]]
            ? CanGlobstarConsume<first, options> extends true
              ? MatchStarOnlySegments<rest, patternSegments, options>
              : false
            : false
    : pathSegments extends [infer pathHead extends string, ...infer pathTail extends string[]]
      ? ShouldRejectLeadingDotForPattern<pathHead, head, options> extends true
        ? false
        : MatchStarOnlySegment<pathHead, head> extends true
          ? MatchStarOnlySegments<pathTail, tail, options>
          : false
      : false
  : pathSegments extends []
    ? true
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
type AsciiChar = AsciiPrintable | AsciiControl

type IsCasedLetter<char extends string> = [Lowercase<char>] extends [Uppercase<char>] ? false : true
type IsLikelyPosixAlpha<char extends string> = char extends
  | DigitChar
  | AsciiPunct
  | ' '
  | '\t'
  | '\n'
  | '\r'
  | '\v'
  | '\f'
  ? false
  : true

type IsLowercaseLetter<char extends string> =
  IsCasedLetter<char> extends true ? (char extends Lowercase<char> ? true : false) : false

type IsUppercaseLetter<char extends string> =
  IsCasedLetter<char> extends true ? (char extends Uppercase<char> ? true : false) : false

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
      : IsLowercaseLetter<char>
    : className extends 'upper'
      ? char extends AlphaUpper
        ? true
        : IsUppercaseLetter<char>
      : className extends 'alpha'
        ? char extends AlphaChar | AlphaUpper
          ? true
          : IsLikelyPosixAlpha<char>
        : className extends 'alnum'
          ? char extends AlphaChar | AlphaUpper | DigitChar
            ? true
            : IsLikelyPosixAlpha<char>
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
      ? char extends AlphaRange<start, end>
        ? true
        : false
      : false
    : false
  : start extends DigitChar
    ? end extends DigitChar
      ? char extends DigitChar
        ? char extends DigitRange<start, end>
          ? true
          : false
        : false
      : false
    : false

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
  ? ConsumeSegmentPrefix<text, alt['tokens']> extends infer remainder
    ? [remainder] extends [never]
      ? MatchExtglobAtLeastOne<text, rest, tail, repeat>
      : remainder extends string
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
  ? ConsumePrefix<text, alt['tokens']> extends infer remainder
    ? [remainder] extends [never]
      ? ConsumeWithAlternatives<text, rest, tail, repeat, requireOne>
      : remainder extends string
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

type MatchWithSimpleEngine<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions,
> =
  NormalizeCase<
    MatchPathForPattern<path, pattern, options>,
    options
  > extends infer normalizedPath extends string
    ? MatchBasicPath<normalizedPath, pattern, options>
    : false

type MatchWithAdvancedEngine<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions,
> = MatchGlobParsed<
  NormalizeCase<MatchPathForPattern<path, pattern, options>, options>,
  ParseExpandedGlob<pattern, options>,
  options
>

type MatchWithNormalizedPattern<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions,
> =
  InferMatchEngine<pattern, options> extends infer engine
    ? engine extends 'star'
      ? NormalizeCase<
          MatchPathForPattern<path, pattern, options>,
          options
        > extends infer normalizedPath extends string
        ? MatchStarOnlyPath<normalizedPath, pattern, options>
        : false
      : engine extends 'advanced'
        ? MatchWithAdvancedEngine<path, pattern, options>
        : MatchWithSimpleEngine<path, pattern, options>
    : false

type InferMatchGlobEngineWithOptions<pattern extends string, options extends GlobMatchOptions> =
  NormalizePatternWithOptions<pattern, options> extends infer normalizedPattern extends string
    ? InferMatchEngine<normalizedPattern, options> extends 'advanced'
      ? 'advanced'
      : 'simple'
    : never

// Engine classifier for tests/benchmarks.
export type InferMatchGlobEngine<
  pattern extends string,
  options extends GlobMatchOptions = {},
> = pattern extends ForceDistributive ? InferMatchGlobEngineWithOptions<pattern, options> : never

// Forces simple-engine matching for tests.
export type MatchGlobSimple<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions = {},
> = true extends (
  pattern extends ForceDistributive
    ? NormalizePatternWithOptions<pattern, options> extends infer normalizedPattern extends string
      ? MatchWithSimpleEngine<path, normalizedPattern, options>
      : false
    : never
)
  ? true
  : false

// Forces advanced-engine matching for tests.
export type MatchGlobAdvanced<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions = {},
> = true extends (
  pattern extends ForceDistributive
    ? NormalizePatternWithOptions<pattern, options> extends infer normalizedPattern extends string
      ? MatchWithAdvancedEngine<path, normalizedPattern, options>
      : false
    : never
)
  ? true
  : false

type MatchWithOptions<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions,
> =
  OptionEnabled<options, 'nobrace'> extends true
    ? NormalizeCase<pattern, options> extends infer normalizedPattern extends string
      ? MatchWithNormalizedPattern<path, normalizedPattern, options>
      : false
    : NormalizePatternWithOptions<pattern, options> extends infer normalizedPattern extends string
      ? MatchWithNormalizedPattern<path, normalizedPattern, options>
      : false

export type MatchGlob<
  path extends string,
  pattern extends string,
  options extends GlobMatchOptions = {},
> = true extends (
  pattern extends ForceDistributive ? MatchWithOptions<path, pattern, options> : never
)
  ? true
  : false

export type MatchedPatterns<
  path extends string,
  patterns extends string,
  options extends GlobMatchOptions = {},
> = patterns extends ForceDistributive
  ? MatchGlob<path, patterns, options> extends true
    ? patterns
    : never
  : never
