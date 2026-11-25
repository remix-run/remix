import type { PartPattern, PartPatternToken } from '../route-pattern.ts'
import type { MatchParamMeta } from './types.ts'
import { consumeMatchWork, type MatchWorkBudget } from './limits.ts'

export type Unit = {
  readonly value: string
  readonly structural: boolean
  readonly begin: number
  readonly end: number
}

export type CanonicalText = {
  readonly units: ReadonlyArray<Unit>
  readonly length: number
}

type CompiledToken =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: ':' | '*'; readonly name: string }
  | { readonly type: '('; readonly end: number }
  | { readonly type: ')' }

type UnitCompiledToken =
  | { readonly type: 'text'; readonly unit: Unit }
  | { readonly type: 'separator'; readonly unit: Unit }
  | Extract<PartPatternToken, { type: ':' | '*' | '(' | ')' }>

export type PartProgram = {
  readonly type: PartPattern['type']
  readonly tokens: ReadonlyArray<CompiledToken>
  readonly captureNames: ReadonlyArray<string>
  readonly matchKind: 'static' | 'linear' | 'trailing-wildcard' | 'single-wildcard' | 'state'
  readonly hasNonStructuralSep: boolean
  readonly staticPrefix: string
  readonly staticSuffix: string
  readonly requiredAnchors: ReadonlyArray<string>
  readonly minLen: Int32Array
  readonly maxLen: Float64Array
  readonly unitTokens: ReadonlyArray<UnitCompiledToken> | null
  readonly unitOptionals: ReadonlyMap<number, number> | null
}

type CaptureNode = {
  readonly type: ':' | '*'
  readonly name: string
  readonly begin: number
  readonly end: number
  readonly next: CaptureNode | null
}

type Solution = {
  readonly captures: CaptureNode | null
  readonly captureCount: number
}

const emptySolution: Solution = { captures: null, captureCount: 0 }
const emptyMeta: ReadonlyArray<MatchParamMeta> = []

// Encoded byte-length for ASCII code points in canonical pathname representation.
// Structural '/' and '.' have length 1; unreserved encodeURIComponent chars have length 1;
// all other ASCII chars encode as %XX (length 3).
const pathEncodedLenTable = new Uint8Array(128)
pathEncodedLenTable.fill(3)
for (let c = 48; c <= 57; c++) pathEncodedLenTable[c] = 1 // 0-9
for (let c = 65; c <= 90; c++) pathEncodedLenTable[c] = 1 // A-Z
for (let c = 97; c <= 122; c++) pathEncodedLenTable[c] = 1 // a-z
pathEncodedLenTable[33] = 1 // !
pathEncodedLenTable[39] = 1 // '
pathEncodedLenTable[40] = 1 // (
pathEncodedLenTable[41] = 1 // )
pathEncodedLenTable[42] = 1 // *
pathEncodedLenTable[45] = 1 // -
pathEncodedLenTable[46] = 1 // . (structural)
pathEncodedLenTable[47] = 1 // / (structural)
pathEncodedLenTable[95] = 1 // _
pathEncodedLenTable[126] = 1 // ~

// Lookup table for non-structural ASCII chars (where '.' and '/' are encoded as %2E and %2F = 3).
const dataEncodedLenTable = new Uint8Array(pathEncodedLenTable)
dataEncodedLenTable[46] = 3
dataEncodedLenTable[47] = 3

// Computes canonical encoded length for a pathname slice where all '/' and '.' are structural.
export function encodedPathnameLength(text: string, start: number, end: number): number {
  let len = 0
  for (let i = start; i < end; i++) {
    let code = text.charCodeAt(i)
    if (code < 128) {
      len += pathEncodedLenTable[code]
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < end) {
      len += 12
      i += 1
    } else if (code <= 0x7ff) {
      len += 6
    } else {
      len += 9
    }
  }
  return len
}

function encodedDataCharLength(
  code: number,
  isSurrogate: boolean,
  type: PartPattern['type'],
): number {
  if (type === 'hostname') return isSurrogate ? 2 : 1
  if (isSurrogate) return 12
  if (code < 128) return dataEncodedLenTable[code]
  if (code <= 0x7ff) return 6
  return 9
}

export function canonicalizePatternSegmentText(
  text: string,
  type: PartPattern['type'],
  ignoreCase: boolean,
): { text: string; hasNonStructuralSep: boolean } {
  let hasPercent = text.indexOf('%') !== -1
  let hasEscapedSlash = type === 'pathname' && text.indexOf('/') !== -1
  if (!hasPercent && !hasEscapedSlash) {
    return { text: ignoreCase ? text.toLowerCase() : text, hasNonStructuralSep: false }
  }

  let result = ''
  let hasNonStructuralSep = false
  let start = 0
  for (let i = 0; i <= text.length; i++) {
    if (i < text.length && text.charCodeAt(i) !== 46) continue // '.'
    if (i > start) {
      let chunk = text.slice(start, i)
      let decoded: string
      if (chunk.indexOf('%') !== -1) {
        try {
          decoded = decodeURIComponent(chunk)
        } catch (error) {
          if (!(error instanceof URIError)) throw error
          decoded = chunk
        }
      } else {
        decoded = chunk
      }
      if (ignoreCase) decoded = decoded.toLowerCase()
      if (
        !hasNonStructuralSep &&
        (decoded.indexOf('.') !== -1 || (type === 'pathname' && decoded.indexOf('/') !== -1))
      ) {
        hasNonStructuralSep = true
      }
      result += decoded
    }
    if (i < text.length) {
      result += '.'
    }
    start = i + 1
  }
  return { text: result, hasNonStructuralSep }
}

export function compilePart(part: PartPattern, options?: { ignoreCase?: boolean }): PartProgram {
  let ignoreCase = options?.ignoreCase ?? false
  let sepChar = part.type === 'hostname' ? '.' : '/'

  let tokens: Array<CompiledToken> = []
  let optionalStack: Array<number> = []
  let captureNameSet = new Set<string>()
  let captureNames: Array<string> = []
  let hasNonStructuralSep = false

  let appendStaticText = (str: string) => {
    if (str.length === 0) return
    let last = tokens.length > 0 ? tokens[tokens.length - 1] : undefined
    if (last !== undefined && last.type === 'text') {
      tokens[tokens.length - 1] = { type: 'text', text: last.text + str }
    } else {
      tokens.push({ type: 'text', text: str })
    }
  }

  for (let i = 0; i < part.tokens.length; i++) {
    let token = part.tokens[i]
    if (token.type === 'text') {
      let canonical = canonicalizePatternSegmentText(token.text, part.type, ignoreCase)
      if (canonical.hasNonStructuralSep) hasNonStructuralSep = true
      appendStaticText(canonical.text)
    } else if (token.type === 'separator') {
      appendStaticText(sepChar)
    } else if (token.type === '(') {
      optionalStack.push(tokens.length)
      tokens.push({ type: '(', end: -1 })
    } else if (token.type === ')') {
      let begin = optionalStack.pop()
      if (begin === undefined) throw new Error('missing optional begin')
      let closeIdx = tokens.length
      tokens[begin] = { type: '(', end: closeIdx }
      tokens.push({ type: ')' })
    } else if (token.type === ':' || token.type === '*') {
      tokens.push(token)
      if (token.name !== '*' && !captureNameSet.has(token.name)) {
        captureNameSet.add(token.name)
        captureNames.push(token.name)
      }
    }
  }

  // Compute staticPrefix, staticSuffix, requiredAnchors
  let staticPrefix = tokens.length > 0 && tokens[0].type === 'text' ? tokens[0].text : ''
  let staticSuffix =
    tokens.length > 0 && tokens[tokens.length - 1].type === 'text'
      ? (tokens[tokens.length - 1] as { type: 'text'; text: string }).text
      : ''

  let requiredAnchors: Array<string> = []
  let optionalDepth = 0
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]
    if (token.type === '(') {
      optionalDepth += 1
    } else if (token.type === ')') {
      optionalDepth -= 1
    } else if (token.type === 'text' && optionalDepth === 0) {
      // Skip prefix (idx 0) and suffix (last idx) since they are checked directly with startsWith/endsWith
      if (i > 0 && i < tokens.length - 1) {
        requiredAnchors.push(token.text)
      }
    }
  }

  // Compute minLen and maxLen backwards
  let n = tokens.length
  let minLen = new Int32Array(n + 1)
  let maxLen = new Float64Array(n + 1)
  minLen[n] = 0
  maxLen[n] = 0
  for (let s = n - 1; s >= 0; s--) {
    let token = tokens[s]
    if (token.type === 'text') {
      minLen[s] = token.text.length + minLen[s + 1]
      maxLen[s] = token.text.length + maxLen[s + 1]
    } else if (token.type === ':') {
      minLen[s] = 1 + minLen[s + 1]
      maxLen[s] = Infinity
    } else if (token.type === '*') {
      minLen[s] = minLen[s + 1]
      maxLen[s] = Infinity
    } else if (token.type === ')') {
      minLen[s] = minLen[s + 1]
      maxLen[s] = maxLen[s + 1]
    } else if (token.type === '(') {
      let incMin = minLen[s + 1]
      let omitMin = minLen[token.end + 1]
      minLen[s] = incMin < omitMin ? incMin : omitMin
      let incMax = maxLen[s + 1]
      let omitMax = maxLen[token.end + 1]
      maxLen[s] = incMax > omitMax ? incMax : omitMax
    }
  }

  let matchKind = classifyMatchKind(tokens)

  let unitTokens: Array<UnitCompiledToken> | null = null
  let unitOptionals: Map<number, number> | null = null
  if (hasNonStructuralSep) {
    let compiledUnits = compileUnitTokens(part, ignoreCase)
    unitTokens = compiledUnits.tokens
    unitOptionals = compiledUnits.optionals
  }

  return {
    type: part.type,
    tokens,
    captureNames,
    matchKind,
    hasNonStructuralSep,
    staticPrefix,
    staticSuffix,
    requiredAnchors,
    minLen,
    maxLen,
    unitTokens,
    unitOptionals,
  }
}

function classifyMatchKind(tokens: ReadonlyArray<CompiledToken>): PartProgram['matchKind'] {
  let starCount = 0
  let starIdx = -1
  let paramCount = 0
  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i].type
    if (t === '(' || t === ')') return 'state'
    if (t === '*') {
      starCount += 1
      starIdx = i
    } else if (t === ':') {
      paramCount += 1
    }
  }
  if (starCount === 0) {
    return paramCount === 0 ? 'static' : 'linear'
  }
  if (starCount === 1) {
    if (starIdx === tokens.length - 1) return 'trailing-wildcard'
    // Single wildcard followed only by static text (exact unique split!)
    if (starIdx === tokens.length - 2 && tokens[tokens.length - 1].type === 'text') {
      return 'single-wildcard'
    }
  }
  return 'state'
}

function compileUnitTokens(
  part: PartPattern,
  ignoreCase: boolean,
): { tokens: Array<UnitCompiledToken>; optionals: Map<number, number> } {
  let tokens: Array<UnitCompiledToken> = []
  let optionals = new Map<number, number>()
  let optionalStack: Array<number> = []

  for (let token of part.tokens) {
    if (token.type === 'text') {
      let units = canonicalizeText(token.text, part.type, {
        ignoreCase,
        strict: false,
        pattern: true,
      })
      if (units === null) throw new Error('pattern text canonicalization failed')
      for (let unit of units.units) {
        tokens.push({ type: 'text', unit })
      }
    } else if (token.type === 'separator') {
      let value = part.type === 'hostname' ? '.' : '/'
      tokens.push({
        type: 'separator',
        unit: { value, structural: true, begin: 0, end: value.length },
      })
    } else {
      if (token.type === '(') optionalStack.push(tokens.length)
      if (token.type === ')') {
        let begin = optionalStack.pop()
        if (begin === undefined) throw new Error('missing optional begin')
        optionals.set(begin, tokens.length)
      }
      tokens.push(token)
    }
  }

  return { tokens, optionals }
}

// Lazily compiles unit tokens when a URL has encoded separators (%2E/%2F).
export function ensureUnitProgram(
  part: PartPattern,
  program: PartProgram,
  ignoreCase: boolean,
): { tokens: ReadonlyArray<UnitCompiledToken>; optionals: ReadonlyMap<number, number> } {
  if (program.unitTokens !== null && program.unitOptionals !== null) {
    return { tokens: program.unitTokens, optionals: program.unitOptionals }
  }
  let compiled = compileUnitTokens(part, ignoreCase)
  return compiled
}

export function canonicalizeUrlPart(
  text: string,
  type: PartPattern['type'],
  options: { budget: MatchWorkBudget; ignoreCase?: boolean },
): CanonicalText | null {
  consumeMatchWork(options.budget, text.length)
  return canonicalizeText(text, type, {
    ignoreCase: options.ignoreCase,
    strict: true,
    pattern: false,
  })
}

function canonicalizeText(
  text: string,
  type: PartPattern['type'],
  options: { ignoreCase?: boolean; strict: boolean; pattern: boolean },
): CanonicalText | null {
  let units: Array<Unit> = []
  let offset = 0
  let chunkStart = 0
  let checkSlash = type === 'pathname' && !options.pattern
  let ignoreCase = options.ignoreCase ?? false

  let flushChunk = (end: number): boolean => {
    if (end <= chunkStart) return true
    let chunk = text.slice(chunkStart, end)
    let decoded: string
    if (chunk.indexOf('%') !== -1) {
      try {
        decoded = decodeURIComponent(chunk)
      } catch (error) {
        if (!(error instanceof URIError)) throw error
        if (options.strict) return false
        decoded = chunk
      }
    } else {
      decoded = chunk
    }
    if (ignoreCase) decoded = decoded.toLowerCase()
    for (let i = 0; i < decoded.length; i++) {
      let code = decoded.charCodeAt(i)
      let isSurrogate = code >= 0xd800 && code <= 0xdbff && i + 1 < decoded.length
      let value = isSurrogate ? decoded.slice(i, i + 2) : decoded[i]
      if (isSurrogate) i += 1
      let encLen = encodedDataCharLength(code, isSurrogate, type)
      units.push({ value, structural: false, begin: offset, end: offset + encLen })
      offset += encLen
    }
    return true
  }

  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i)
    let structural = code === 46 || (checkSlash && code === 47) // '.' or '/'
    if (!structural) continue
    if (!flushChunk(i)) return null
    let char = code === 46 ? '.' : '/'
    units.push({ value: char, structural: true, begin: offset, end: offset + 1 })
    offset += 1
    chunkStart = i + 1
  }
  if (!flushChunk(text.length)) return null

  return { units, length: offset }
}

function isStructuralCode(code: number, isPathname: boolean): boolean {
  return code === 46 || (isPathname && code === 47)
}

function scanNonStructuralEnd(input: string, pos: number, isPathname: boolean): number {
  let len = input.length
  while (pos < len && !isStructuralCode(input.charCodeAt(pos), isPathname)) {
    pos += 1
  }
  return pos
}

function makeStringParamMeta(
  input: string,
  type: ':' | '*',
  name: string,
  begin: number,
  end: number,
  isPathname: boolean,
): MatchParamMeta {
  let value = input.slice(begin, end)
  if (!isPathname) {
    return { type, name, value, begin, end }
  }
  let encBegin = encodedPathnameLength(input, 0, begin)
  let encEnd = encBegin + encodedPathnameLength(input, begin, end)
  return { type, name, value, begin: encBegin, end: encEnd }
}

// Matches a compiled PartProgram against a string where every '/' and '.' is structural.
export function matchPartString(
  program: PartProgram,
  input: string,
  budget: MatchWorkBudget,
): ReadonlyArray<MatchParamMeta> | null {
  let len = input.length
  let kind = program.matchKind
  if (kind === 'static') {
    consumeMatchWork(budget, 1 + len)
    return input === program.staticPrefix ? emptyMeta : null
  }

  if (len < program.minLen[0] || len > program.maxLen[0]) {
    consumeMatchWork(budget, 1)
    return null
  }

  if (program.staticPrefix.length > 0 && !input.startsWith(program.staticPrefix)) {
    consumeMatchWork(budget, 1)
    return null
  }
  if (program.staticSuffix.length > 0 && !input.endsWith(program.staticSuffix)) {
    consumeMatchWork(budget, 1)
    return null
  }

  if (kind === 'linear') {
    consumeMatchWork(budget, program.tokens.length + len)
    return matchLinearString(program, input)
  }

  if (kind === 'trailing-wildcard') {
    consumeMatchWork(budget, program.tokens.length + len)
    return matchTrailingWildcardString(program, input)
  }

  if (kind === 'single-wildcard') {
    consumeMatchWork(budget, program.tokens.length + len)
    return matchSingleWildcardString(program, input)
  }

  // Required-anchors pre-check before running state matcher
  if (program.requiredAnchors.length > 0) {
    consumeMatchWork(budget, len + program.requiredAnchors.length)
    let searchPos = program.staticPrefix.length
    let maxEnd = len - program.staticSuffix.length
    for (let i = 0; i < program.requiredAnchors.length; i++) {
      let anchor = program.requiredAnchors[i]
      let found = input.indexOf(anchor, searchPos)
      if (found === -1 || found + anchor.length > maxEnd) return null
      searchPos = found + anchor.length
    }
  }

  return matchStateString(program, input, budget)
}

function matchLinearString(
  program: PartProgram,
  input: string,
): ReadonlyArray<MatchParamMeta> | null {
  let isPathname = program.type === 'pathname'
  let tokens = program.tokens
  let pos = 0
  let len = input.length
  let captures: Array<MatchParamMeta> = []

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]
    if (token.type === 'text') {
      if (!input.startsWith(token.text, pos)) return null
      pos += token.text.length
    } else if (token.type === ':') {
      let begin = pos
      pos = scanNonStructuralEnd(input, pos, isPathname)
      if (pos === begin) return null
      captures.push(makeStringParamMeta(input, ':', token.name, begin, pos, isPathname))
    } else {
      throw new Error(`unexpected linear token: ${token.type}`)
    }
  }

  return pos === len ? captures : null
}

function matchTrailingWildcardString(
  program: PartProgram,
  input: string,
): ReadonlyArray<MatchParamMeta> | null {
  let isPathname = program.type === 'pathname'
  let tokens = program.tokens
  let lastIdx = tokens.length - 1
  let pos = 0
  let captures: Array<MatchParamMeta> = []

  for (let i = 0; i < lastIdx; i++) {
    let token = tokens[i]
    if (token.type === 'text') {
      if (!input.startsWith(token.text, pos)) return null
      pos += token.text.length
    } else if (token.type === ':') {
      let begin = pos
      pos = scanNonStructuralEnd(input, pos, isPathname)
      if (pos === begin) return null
      captures.push(makeStringParamMeta(input, ':', token.name, begin, pos, isPathname))
    } else {
      throw new Error(`unexpected trailing-wildcard token: ${token.type}`)
    }
  }

  let star = tokens[lastIdx] as { type: '*'; name: string }
  captures.push(makeStringParamMeta(input, '*', star.name, pos, input.length, isPathname))
  return captures
}

function matchSingleWildcardString(
  program: PartProgram,
  input: string,
): ReadonlyArray<MatchParamMeta> | null {
  let isPathname = program.type === 'pathname'
  let tokens = program.tokens
  let starIdx = tokens.length - 2
  let suffixToken = tokens[tokens.length - 1] as { type: 'text'; text: string }
  let suffixStart = input.length - suffixToken.text.length
  if (suffixStart < 0 || !input.endsWith(suffixToken.text)) return null

  let pos = 0
  let captures: Array<MatchParamMeta> = []
  for (let i = 0; i < starIdx; i++) {
    let token = tokens[i]
    if (token.type === 'text') {
      if (!input.startsWith(token.text, pos)) return null
      pos += token.text.length
    } else if (token.type === ':') {
      let begin = pos
      pos = scanNonStructuralEnd(input, pos, isPathname)
      if (pos === begin || pos > suffixStart) return null
      captures.push(makeStringParamMeta(input, ':', token.name, begin, pos, isPathname))
    } else {
      throw new Error(`unexpected single-wildcard token: ${token.type}`)
    }
  }

  if (pos > suffixStart) return null
  let star = tokens[starIdx] as { type: '*'; name: string }
  captures.push(makeStringParamMeta(input, '*', star.name, pos, suffixStart, isPathname))
  return captures
}

function matchStateString(
  program: PartProgram,
  input: string,
  budget: MatchWorkBudget,
): ReadonlyArray<MatchParamMeta> | null {
  let tokens = program.tokens
  let n = tokens.length
  let len = input.length
  let isPathname = program.type === 'pathname'
  let minLen = program.minLen
  let maxLen = program.maxLen

  // Guard JS recursion depth for unusually large patterns (e.g. >512 tokens)
  if (n > 512) {
    return matchStateStringBottomUp(program, input, budget)
  }

  let stride = len + 1
  let totalCells = (n + 1) * stride
  let flatMemo: Array<Solution | null | undefined> | null =
    totalCells <= 4096 ? new Array<Solution | null | undefined>(totalCells) : null
  let sparseMemo: Map<number, Solution | null> | null = flatMemo === null ? new Map() : null
  let hostnameOrder: Array<number> | null | undefined = isPathname ? null : undefined

  let getHostnameOrder = (): ReadonlyArray<number> | null => {
    if (hostnameOrder === undefined) {
      hostnameOrder = hostnameStringPositions(input)
    }
    return hostnameOrder
  }

  let solve = (state: number, pos: number): Solution | null => {
    let rem = len - pos
    if (rem < minLen[state] || rem > maxLen[state]) return null
    if (state === n) return pos === len ? emptySolution : null

    let key = state * stride + pos
    if (flatMemo !== null) {
      let cached = flatMemo[key]
      if (cached !== undefined) return cached
    } else {
      let cached = sparseMemo!.get(key)
      if (cached !== undefined) return cached
    }

    consumeMatchWork(budget, 1)
    let token = tokens[state]
    let result: Solution | null

    if (token.type === ')') {
      result = solve(state + 1, pos)
    } else if (token.type === '(') {
      let omitted = solve(token.end + 1, pos)
      let included = solve(state + 1, pos)
      if (omitted === null) {
        result = included
      } else if (included === null) {
        result = omitted
      } else {
        result = betterSolution(len, getHostnameOrder(), omitted, included, budget, pos)
      }
    } else if (token.type === 'text') {
      if (input.startsWith(token.text, pos)) {
        result = solve(state + 1, pos + token.text.length)
      } else {
        result = null
      }
    } else if (token.type === ':') {
      let end = scanNonStructuralEnd(input, pos, isPathname)
      consumeMatchWork(budget, end - pos)
      if (end === pos) {
        result = null
      } else {
        let suffix = solve(state + 1, end)
        result = prependCapture(suffix, { type: ':', name: token.name, begin: pos, end })
      }
    } else {
      // '*'
      let maxEnd = len - minLen[state + 1]
      let nextToken = tokens[state + 1]
      if (nextToken === undefined) {
        result = {
          captures: { type: '*', name: token.name, begin: pos, end: len, next: null },
          captureCount: 1,
        }
      } else if (nextToken.type === 'text') {
        let best: Solution | null = null
        let endPos = input.indexOf(nextToken.text, pos)
        while (endPos !== -1 && endPos <= maxEnd) {
          consumeMatchWork(budget, 1)
          let tail = solve(state + 2, endPos + nextToken.text.length)
          if (tail !== null) {
            let candidate = prependCapture(tail, {
              type: '*',
              name: token.name,
              begin: pos,
              end: endPos,
            })!
            if (isPathname) {
              // Earliest static continuation strictly beats any later wildcard split in pathname.
              best = candidate
              break
            }
            best =
              best === null
                ? candidate
                : betterSolution(len, getHostnameOrder(), candidate, best, budget, pos)
          }
          endPos = input.indexOf(nextToken.text, endPos + 1)
        }
        result = best
      } else {
        let best: Solution | null = null
        for (let endPos = pos; endPos <= maxEnd; endPos++) {
          consumeMatchWork(budget, 1)
          let tail = solve(state + 1, endPos)
          if (tail !== null) {
            let candidate = prependCapture(tail, {
              type: '*',
              name: token.name,
              begin: pos,
              end: endPos,
            })!
            best =
              best === null
                ? candidate
                : betterSolution(len, getHostnameOrder(), candidate, best, budget, pos)
          }
        }
        result = best
      }
    }

    if (flatMemo !== null) {
      flatMemo[key] = result
    } else {
      sparseMemo!.set(key, result)
    }
    return result
  }

  let solution = solve(0, 0)
  if (solution === null) return null
  return materializeStringCaptures(input, solution.captures, isPathname)
}

function matchStateStringBottomUp(
  program: PartProgram,
  input: string,
  budget: MatchWorkBudget,
): ReadonlyArray<MatchParamMeta> | null {
  let tokens = program.tokens
  let n = tokens.length
  let len = input.length
  let isPathname = program.type === 'pathname'
  let minLen = program.minLen
  let maxLen = program.maxLen
  let stride = len + 1
  consumeMatchWork(budget, (n + 1) * stride)

  let solutions = new Array<Solution | null>((n + 1) * stride).fill(null)
  let hostnameOrder = isPathname ? null : hostnameStringPositions(input)

  for (let pos = len; pos >= 0; pos--) {
    let rem = len - pos
    solutions[n * stride + pos] = pos === len ? emptySolution : null

    for (let state = n - 1; state >= 0; state--) {
      if (rem < minLen[state] || rem > maxLen[state]) continue
      let token = tokens[state]
      let cell = state * stride + pos

      if (token.type === ')') {
        solutions[cell] = solutions[(state + 1) * stride + pos]
      } else if (token.type === '(') {
        let omitted = solutions[(token.end + 1) * stride + pos]
        let included = solutions[(state + 1) * stride + pos]
        solutions[cell] = betterSolution(len, hostnameOrder, omitted, included, budget, pos)
      } else if (token.type === 'text') {
        solutions[cell] = input.startsWith(token.text, pos)
          ? solutions[(state + 1) * stride + pos + token.text.length]
          : null
      } else if (token.type === ':') {
        let end = scanNonStructuralEnd(input, pos, isPathname)
        consumeMatchWork(budget, end - pos)
        let suffix = end === pos ? null : solutions[(state + 1) * stride + end]
        solutions[cell] = prependCapture(suffix, { type: ':', name: token.name, begin: pos, end })
      } else {
        let consumed: Solution | null = null
        if (pos < len) {
          let next = solutions[cell + 1]
          if (next !== null) {
            let capture = next.captures
            if (capture === null || capture.type !== '*' || capture.name !== token.name) {
              throw new Error('invalid wildcard continuation')
            }
            consumed = {
              captures: { ...capture, begin: pos },
              captureCount: next.captureCount,
            }
          }
        }
        let exited = prependCapture(solutions[(state + 1) * stride + pos], {
          type: '*',
          name: token.name,
          begin: pos,
          end: pos,
        })
        solutions[cell] = betterSolution(len, hostnameOrder, consumed, exited, budget, pos)
      }
    }
  }

  let solution = solutions[0]
  if (solution === null) return null
  return materializeStringCaptures(input, solution.captures, isPathname)
}

function materializeStringCaptures(
  input: string,
  captures: CaptureNode | null,
  isPathname: boolean,
): ReadonlyArray<MatchParamMeta> {
  if (captures === null) return emptyMeta
  let result: Array<MatchParamMeta> = []
  let curIdx = 0
  let curEncOffset = 0
  for (let capture: CaptureNode | null = captures; capture !== null; capture = capture.next) {
    let value = input.slice(capture.begin, capture.end)
    if (!isPathname) {
      result.push({
        type: capture.type,
        name: capture.name,
        value,
        begin: capture.begin,
        end: capture.end,
      })
    } else {
      curEncOffset += encodedPathnameLength(input, curIdx, capture.begin)
      let encBegin = curEncOffset
      curEncOffset += encodedPathnameLength(input, capture.begin, capture.end)
      let encEnd = curEncOffset
      curIdx = capture.end
      result.push({
        type: capture.type,
        name: capture.name,
        value,
        begin: encBegin,
        end: encEnd,
      })
    }
  }
  return result
}

// Unit-level matcher for patterns or URLs with non-structural encoded separators (%2E / %2F).
export function matchPartUnits(
  tokens: ReadonlyArray<UnitCompiledToken>,
  optionals: ReadonlyMap<number, number>,
  type: PartPattern['type'],
  input: CanonicalText,
  budget: MatchWorkBudget,
): ReadonlyArray<MatchParamMeta> | null {
  let stateCount = tokens.length + 1
  let inputLength = input.units.length
  consumeMatchWork(budget, stateCount * (inputLength + 1))

  let hostnameOrder = type === 'hostname' ? hostnameUnitPositions(input.units) : null
  let stride = inputLength + 1
  let solutions = new Array<Solution | null>(stateCount * stride).fill(null)

  for (let position = inputLength; position >= 0; position--) {
    solutions[tokens.length * stride + position] = position === inputLength ? emptySolution : null

    for (let state = tokens.length - 1; state >= 0; state--) {
      let token = tokens[state]
      let cell = state * stride + position

      if (token.type === ')') {
        solutions[cell] = solutions[(state + 1) * stride + position]
        continue
      }

      if (token.type === '(') {
        let end = optionals.get(state)
        if (end === undefined) throw new Error('missing optional end')
        let omitted = solutions[(end + 1) * stride + position]
        let included = solutions[(state + 1) * stride + position]
        solutions[cell] = betterSolution(
          inputLength,
          hostnameOrder,
          omitted,
          included,
          budget,
          position,
        )
        continue
      }

      if (token.type === 'text' || token.type === 'separator') {
        let unit = input.units[position]
        solutions[cell] =
          unit !== undefined && unitsEqual(unit, token.unit)
            ? solutions[(state + 1) * stride + position + 1]
            : null
        continue
      }

      if (token.type === ':') {
        let end = position
        while (end < inputLength && !input.units[end].structural) {
          consumeMatchWork(budget, 1)
          end += 1
        }
        let suffix = end === position ? null : solutions[(state + 1) * stride + end]
        solutions[cell] = prependCapture(suffix, {
          type: token.type,
          name: token.name,
          begin: position,
          end,
        })
        continue
      }

      if (token.type !== '*') throw new Error(`unexpected token: ${token.type}`)

      let consumed: Solution | null = null
      if (position < inputLength) {
        let next = solutions[cell + 1]
        if (next !== null) {
          let capture = next.captures
          if (capture === null || capture.type !== '*' || capture.name !== token.name) {
            throw new Error('invalid wildcard continuation')
          }
          consumed = {
            captures: { ...capture, begin: position },
            captureCount: next.captureCount,
          }
        }
      }
      let exited = prependCapture(solutions[(state + 1) * stride + position], {
        type: token.type,
        name: token.name,
        begin: position,
        end: position,
      })
      solutions[cell] = betterSolution(
        inputLength,
        hostnameOrder,
        consumed,
        exited,
        budget,
        position,
      )
    }
  }

  let solution = solutions[0]
  if (solution === null) return null
  let result: Array<MatchParamMeta> = []
  for (let capture = solution.captures; capture !== null; capture = capture.next) {
    result.push(toUnitMatchParamMeta(input, capture))
  }
  return result
}

function toUnitMatchParamMeta(input: CanonicalText, capture: CaptureNode): MatchParamMeta {
  let value = ''
  for (let position = capture.begin; position < capture.end; position++) {
    value += input.units[position].value
  }
  return {
    type: capture.type,
    name: capture.name,
    value,
    begin: offsetAt(input, capture.begin),
    end: offsetAt(input, capture.end),
  }
}

function unitsEqual(a: Unit, b: Unit): boolean {
  return a.value === b.value && a.structural === b.structural
}

function prependCapture(
  solution: Solution | null,
  capture: Omit<CaptureNode, 'next'>,
): Solution | null {
  return solution === null
    ? null
    : {
        captures: { ...capture, next: solution.captures },
        captureCount: solution.captureCount + 1,
      }
}

function betterSolution(
  inputLength: number,
  hostnameOrder: ReadonlyArray<number> | null,
  preferred: Solution | null,
  alternative: Solution | null,
  budget: MatchWorkBudget,
  startPos: number,
): Solution | null {
  if (preferred === null) return alternative
  if (alternative === null) return preferred
  let comparison = compareSolutions(
    inputLength,
    hostnameOrder,
    preferred,
    alternative,
    budget,
    startPos,
  )
  return comparison >= 0 ? preferred : alternative
}

function compareSolutions(
  inputLength: number,
  hostnameOrder: ReadonlyArray<number> | null,
  a: Solution,
  b: Solution,
  budget: MatchWorkBudget,
  startPos: number,
): -1 | 0 | 1 {
  if (hostnameOrder === null) {
    let aCap = a.captures
    let bCap = b.captures
    let pos = startPos
    while (aCap !== null || bCap !== null) {
      consumeMatchWork(budget, 1)
      while (aCap !== null && (aCap.end <= pos || aCap.begin === aCap.end)) {
        aCap = aCap.next
      }
      while (bCap !== null && (bCap.end <= pos || bCap.begin === bCap.end)) {
        bCap = bCap.next
      }
      if (aCap === null && bCap === null) break
      if (aCap === null) return 1
      if (bCap === null) return -1

      let nextPos = aCap.begin < bCap.begin ? aCap.begin : bCap.begin
      if (nextPos > pos) pos = nextPos

      let aSpec = aCap.begin > pos ? 0 : aCap.type === ':' ? 1 : 2
      let bSpec = bCap.begin > pos ? 0 : bCap.type === ':' ? 1 : 2
      if (aSpec < bSpec) return 1
      if (aSpec > bSpec) return -1

      let nextA = aCap.begin > pos ? aCap.begin : aCap.end
      let nextB = bCap.begin > pos ? bCap.begin : bCap.end
      pos = nextA < nextB ? nextA : nextB
    }
  } else {
    let aEncoding = encodeSpecificity(inputLength, a.captures, budget)
    let bEncoding = encodeSpecificity(inputLength, b.captures, budget)
    for (let position of hostnameOrder) {
      consumeMatchWork(budget, 1)
      if (aEncoding[position] < bEncoding[position]) return 1
      if (aEncoding[position] > bEncoding[position]) return -1
    }
  }
  if (a.captureCount < b.captureCount) return 1
  if (a.captureCount > b.captureCount) return -1
  return 0
}

function encodeSpecificity(
  length: number,
  captures: CaptureNode | null,
  budget: MatchWorkBudget,
): Uint8Array {
  consumeMatchWork(budget, length)
  let encoding = new Uint8Array(length)
  for (let capture = captures; capture !== null; capture = capture.next) {
    consumeMatchWork(budget, 1 + capture.end - capture.begin)
    encoding.fill(capture.type === ':' ? 1 : 2, capture.begin, capture.end)
  }
  return encoding
}

function hostnameStringPositions(input: string): Array<number> {
  let result: Array<number> = []
  let end = input.length
  for (let i = input.length - 1; i >= 0; i--) {
    if (input.charCodeAt(i) === 46) {
      for (let j = i + 1; j < end; j++) result.push(j)
      end = i
    }
  }
  for (let i = 0; i < end; i++) result.push(i)
  return result
}

function hostnameUnitPositions(input: ReadonlyArray<Unit>): Array<number> {
  let result: Array<number> = []
  let end = input.length
  for (let i = input.length - 1; i >= 0; i--) {
    if (input[i].structural && input[i].value === '.') {
      for (let j = i + 1; j < end; j++) result.push(j)
      end = i
    }
  }
  for (let i = 0; i < end; i++) result.push(i)
  return result
}

function offsetAt(input: CanonicalText, position: number): number {
  if (position === input.units.length) return input.length
  return input.units[position].begin
}
