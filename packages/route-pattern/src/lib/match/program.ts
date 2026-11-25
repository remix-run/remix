import type { PartPattern } from '../route-pattern.ts'
import type { MatchParamMeta } from './types.ts'
import { consumeMatchWork } from './limits.ts'
import type { MatchWorkBudget } from './limits.ts'

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

export type UnitCompiledToken =
  | { readonly type: 'unit'; readonly value: string; readonly structural: boolean }
  | { readonly type: ':' | '*'; readonly name: string }
  | { readonly type: '('; readonly end: number }
  | { readonly type: ')' }

export type PartProgram = {
  readonly part: PartPattern
  readonly ignoreCase: boolean
  readonly type: PartPattern['type']
  readonly tokens: ReadonlyArray<CompiledToken>
  readonly matchKind: 'static' | 'linear' | 'trailing-wildcard' | 'single-wildcard' | 'state'
  readonly hasNonStructuralSep: boolean
  readonly staticPrefix: string
  readonly staticSuffix: string
  readonly requiredAnchors: ReadonlyArray<string>
  readonly minLen: Int32Array
  readonly maxLen: Float64Array
  unitTokens: ReadonlyArray<UnitCompiledToken> | null
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

// Canonical encoded length for ASCII code points in pathname representation.
// Structural '/' and '.' have length 1; unreserved encodeURIComponent chars have length 1;
// all other ASCII chars encode as %XX (length 3).
const pathEncodedLenTable = new Uint8Array(128)
for (let c = 0; c < 128; c++) {
  pathEncodedLenTable[c] = encodeURIComponent(String.fromCharCode(c)).length
}
pathEncodedLenTable[47] = 1 // '/' (structural)

// Lookup table for non-structural ASCII chars (where '.' and '/' are encoded as %2E and %2F = 3).
const dataEncodedLenTable = new Uint8Array(pathEncodedLenTable)
dataEncodedLenTable[46] = 3
dataEncodedLenTable[47] = 3

function encodedCharLength(code: number, isSurrogate: boolean, table: Uint8Array): number {
  if (isSurrogate) return 12
  if (code < 128) return table[code]
  return code <= 0x7ff ? 6 : 9
}

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
    } else {
      len += code <= 0x7ff ? 6 : 9
    }
  }
  return len
}

export function decodePercentChunk(chunk: string, strict: boolean): string | null {
  if (chunk.indexOf('%') === -1) return chunk
  try {
    return decodeURIComponent(chunk)
  } catch (error) {
    if (!(error instanceof URIError)) throw error
    return strict ? null : chunk
  }
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
    if (i < text.length && text.charCodeAt(i) !== 46) continue
    if (i > start) {
      let decoded = decodePercentChunk(text.slice(start, i), false)!
      if (ignoreCase) decoded = decoded.toLowerCase()
      if (
        !hasNonStructuralSep &&
        (decoded.indexOf('.') !== -1 || (type === 'pathname' && decoded.indexOf('/') !== -1))
      ) {
        hasNonStructuralSep = true
      }
      result += decoded
    }
    if (i < text.length) result += '.'
    start = i + 1
  }
  return { text: result, hasNonStructuralSep }
}

export function compilePart(part: PartPattern, options?: { ignoreCase?: boolean }): PartProgram {
  let ignoreCase = options?.ignoreCase ?? false
  let sepChar = part.type === 'hostname' ? '.' : '/'

  let tokens: Array<CompiledToken> = []
  let optionalStack: Array<number> = []
  let hasNonStructuralSep = false

  let appendStaticText = (str: string) => {
    if (str.length === 0) return
    let last = tokens[tokens.length - 1]
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
      let begin = optionalStack.pop()!
      tokens[begin] = { type: '(', end: tokens.length }
      tokens.push({ type: ')' })
    } else if (token.type === ':' || token.type === '*') {
      tokens.push(token)
    }
  }

  let firstToken = tokens[0]
  let lastToken = tokens[tokens.length - 1]
  let staticPrefix = firstToken !== undefined && firstToken.type === 'text' ? firstToken.text : ''
  let staticSuffix = lastToken !== undefined && lastToken.type === 'text' ? lastToken.text : ''

  let requiredAnchors: Array<string> = []
  let optionalDepth = 0
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]
    if (token.type === '(') {
      optionalDepth += 1
    } else if (token.type === ')') {
      optionalDepth -= 1
    } else if (token.type === 'text' && optionalDepth === 0 && i > 0 && i < tokens.length - 1) {
      requiredAnchors.push(token.text)
    }
  }

  let n = tokens.length
  let minLen = new Int32Array(n + 1)
  let maxLen = new Float64Array(n + 1)
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

  return {
    part,
    ignoreCase,
    type: part.type,
    tokens,
    matchKind: classifyMatchKind(tokens),
    hasNonStructuralSep,
    staticPrefix,
    staticSuffix,
    requiredAnchors,
    minLen,
    maxLen,
    unitTokens: hasNonStructuralSep ? compileUnitTokens(part, ignoreCase) : null,
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
  if (starCount === 0) return paramCount === 0 ? 'static' : 'linear'
  if (starCount === 1) {
    if (starIdx === tokens.length - 1) return 'trailing-wildcard'
    if (starIdx === tokens.length - 2 && tokens[tokens.length - 1].type === 'text') {
      return 'single-wildcard'
    }
  }
  return 'state'
}

function compileUnitTokens(part: PartPattern, ignoreCase: boolean): Array<UnitCompiledToken> {
  let tokens: Array<UnitCompiledToken> = []
  let optionalStack: Array<number> = []
  let sepChar = part.type === 'hostname' ? '.' : '/'

  for (let token of part.tokens) {
    if (token.type === 'text') {
      let canonical = canonicalizeText(token.text, part.type, { ignoreCase, pattern: true })!
      for (let unit of canonical.units) {
        tokens.push({ type: 'unit', value: unit.value, structural: unit.structural })
      }
    } else if (token.type === 'separator') {
      tokens.push({ type: 'unit', value: sepChar, structural: true })
    } else if (token.type === '(') {
      optionalStack.push(tokens.length)
      tokens.push({ type: '(', end: -1 })
    } else if (token.type === ')') {
      let begin = optionalStack.pop()!
      tokens[begin] = { type: '(', end: tokens.length }
      tokens.push({ type: ')' })
    } else if (token.type === ':' || token.type === '*') {
      tokens.push(token)
    }
  }

  return tokens
}

// Lazily compiles and caches unit tokens when a URL has encoded separators (%2E/%2F).
export function ensureUnitProgram(program: PartProgram): ReadonlyArray<UnitCompiledToken> {
  return (program.unitTokens ??= compileUnitTokens(program.part, program.ignoreCase))
}

export function canonicalizeUrlPart(
  text: string,
  type: PartPattern['type'],
  options: { budget: MatchWorkBudget; ignoreCase?: boolean },
): CanonicalText | null {
  consumeMatchWork(options.budget, text.length)
  return canonicalizeText(text, type, { ignoreCase: options.ignoreCase, pattern: false })
}

function canonicalizeText(
  text: string,
  type: PartPattern['type'],
  options: { ignoreCase?: boolean; pattern: boolean },
): CanonicalText | null {
  let units: Array<Unit> = []
  let offset = 0
  let chunkStart = 0
  let checkSlash = type === 'pathname' && !options.pattern
  let ignoreCase = options.ignoreCase ?? false
  let isHostname = type === 'hostname'

  let flushChunk = (end: number): boolean => {
    if (end <= chunkStart) return true
    let decoded = decodePercentChunk(text.slice(chunkStart, end), !options.pattern)
    if (decoded === null) return false
    if (ignoreCase) decoded = decoded.toLowerCase()
    for (let i = 0; i < decoded.length; i++) {
      let code = decoded.charCodeAt(i)
      let isSurrogate = code >= 0xd800 && code <= 0xdbff && i + 1 < decoded.length
      let value = isSurrogate ? decoded.slice(i, i + 2) : decoded[i]
      if (isSurrogate) i += 1
      let encLen = isHostname
        ? isSurrogate
          ? 2
          : 1
        : encodedCharLength(code, isSurrogate, dataEncodedLenTable)
      units.push({ value, structural: false, begin: offset, end: offset + encLen })
      offset += encLen
    }
    return true
  }

  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i)
    if (code !== 46 && (!checkSlash || code !== 47)) continue
    if (!flushChunk(i)) return null
    units.push({ value: code === 46 ? '.' : '/', structural: true, begin: offset, end: offset + 1 })
    offset += 1
    chunkStart = i + 1
  }
  if (!flushChunk(text.length)) return null

  return { units, length: offset }
}

function scanNonStructuralEnd(input: string, pos: number, isPathname: boolean): number {
  let len = input.length
  while (pos < len) {
    let code = input.charCodeAt(pos)
    if (code === 46 || (isPathname && code === 47)) break
    pos += 1
  }
  return pos
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

  if (
    len < program.minLen[0] ||
    len > program.maxLen[0] ||
    (program.staticPrefix.length > 0 && !input.startsWith(program.staticPrefix)) ||
    (program.staticSuffix.length > 0 && !input.endsWith(program.staticSuffix))
  ) {
    consumeMatchWork(budget, 1)
    return null
  }

  if (kind !== 'state') {
    consumeMatchWork(budget, program.tokens.length + len)
    return matchLinearOrSingleWildcard(program, input, kind)
  }

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

function matchLinearOrSingleWildcard(
  program: PartProgram,
  input: string,
  kind: 'linear' | 'trailing-wildcard' | 'single-wildcard',
): ReadonlyArray<MatchParamMeta> | null {
  let isPathname = program.type === 'pathname'
  let tokens = program.tokens
  let stopIdx =
    kind === 'linear'
      ? tokens.length
      : kind === 'trailing-wildcard'
        ? tokens.length - 1
        : tokens.length - 2
  let maxEnd =
    kind === 'single-wildcard' ? input.length - program.staticSuffix.length : input.length

  let pos = 0
  let curIdx = 0
  let curEncOffset = 0
  let captures: Array<MatchParamMeta> = []

  let pushCapture = (type: ':' | '*', name: string, begin: number, end: number) => {
    let value = input.slice(begin, end)
    if (!isPathname) {
      captures.push({ type, name, value, begin, end })
      return
    }
    curEncOffset += encodedPathnameLength(input, curIdx, begin)
    let encBegin = curEncOffset
    curEncOffset += encodedPathnameLength(input, begin, end)
    let encEnd = curEncOffset
    curIdx = end
    captures.push({ type, name, value, begin: encBegin, end: encEnd })
  }

  for (let i = 0; i < stopIdx; i++) {
    let token = tokens[i]
    if (token.type === 'text') {
      if (!input.startsWith(token.text, pos)) return null
      pos += token.text.length
    } else if (token.type === ':') {
      let begin = pos
      pos = scanNonStructuralEnd(input, pos, isPathname)
      if (pos === begin) return null
      pushCapture(':', token.name, begin, pos)
    } else {
      throw new Error(`unexpected ${kind} token: ${token.type}`)
    }
  }

  if (kind === 'linear') return pos === input.length ? captures : null
  if (pos > maxEnd) return null
  let star = tokens[stopIdx] as { type: '*'; name: string }
  pushCapture('*', star.name, pos, maxEnd)
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
  let hostnameOrder = isPathname ? null : buildHostnameOrder(len, (i) => input.charCodeAt(i) === 46)

  let solve = (state: number, pos: number): Solution | null => {
    let rem = len - pos
    if (rem < minLen[state] || rem > maxLen[state]) return null
    if (state === n) return pos === len ? emptySolution : null

    let key = state * stride + pos
    let cached = flatMemo !== null ? flatMemo[key] : sparseMemo!.get(key)
    if (cached !== undefined) return cached

    consumeMatchWork(budget, 1)
    let token = tokens[state]
    let result: Solution | null

    if (token.type === ')') {
      result = solve(state + 1, pos)
    } else if (token.type === '(') {
      result = betterSolution(
        len,
        hostnameOrder,
        solve(token.end + 1, pos),
        solve(state + 1, pos),
        budget,
        pos,
      )
    } else if (token.type === 'text') {
      result = input.startsWith(token.text, pos) ? solve(state + 1, pos + token.text.length) : null
    } else if (token.type === ':') {
      let end = scanNonStructuralEnd(input, pos, isPathname)
      consumeMatchWork(budget, end - pos)
      result =
        end === pos
          ? null
          : prependCapture(solve(state + 1, end), { type: ':', name: token.name, begin: pos, end })
    } else {
      let maxEnd = len - minLen[state + 1]
      let nextToken = tokens[state + 1]
      if (nextToken === undefined) {
        result = {
          captures: { type: '*', name: token.name, begin: pos, end: len, next: null },
          captureCount: 1,
        }
      } else {
        let best: Solution | null = null
        if (nextToken.type === 'text') {
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
              best = betterSolution(len, hostnameOrder, candidate, best, budget, pos)
            }
            endPos = input.indexOf(nextToken.text, endPos + 1)
          }
        } else {
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
              best = betterSolution(len, hostnameOrder, candidate, best, budget, pos)
            }
          }
        }
        result = best
      }
    }

    if (flatMemo !== null) flatMemo[key] = result
    else sparseMemo!.set(key, result)
    return result
  }

  let solution = solve(0, 0)
  return solution === null ? null : materializeStringCaptures(input, solution.captures, isPathname)
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
  let hostnameOrder = isPathname ? null : buildHostnameOrder(len, (i) => input.charCodeAt(i) === 46)

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
        solutions[cell] = betterSolution(
          len,
          hostnameOrder,
          solutions[(token.end + 1) * stride + pos],
          solutions[(state + 1) * stride + pos],
          budget,
          pos,
        )
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
        solutions[cell] = solveWildcardCell(
          solutions,
          cell,
          state,
          pos,
          len,
          stride,
          token.name,
          hostnameOrder,
          budget,
        )
      }
    }
  }

  let solution = solutions[0]
  return solution === null ? null : materializeStringCaptures(input, solution.captures, isPathname)
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
    let begin = capture.begin
    let end = capture.end
    if (isPathname) {
      curEncOffset += encodedPathnameLength(input, curIdx, capture.begin)
      begin = curEncOffset
      curEncOffset += encodedPathnameLength(input, capture.begin, capture.end)
      end = curEncOffset
      curIdx = capture.end
    }
    result.push({ type: capture.type, name: capture.name, value, begin, end })
  }
  return result
}

// Unit-level matcher for patterns or URLs with non-structural encoded separators (%2E / %2F).
export function matchPartUnits(
  tokens: ReadonlyArray<UnitCompiledToken>,
  type: PartPattern['type'],
  input: CanonicalText,
  budget: MatchWorkBudget,
): ReadonlyArray<MatchParamMeta> | null {
  let stateCount = tokens.length + 1
  let inputLength = input.units.length
  consumeMatchWork(budget, stateCount * (inputLength + 1))

  let hostnameOrder =
    type === 'hostname'
      ? buildHostnameOrder(
          inputLength,
          (i) => input.units[i].structural && input.units[i].value === '.',
        )
      : null
  let stride = inputLength + 1
  let solutions = new Array<Solution | null>(stateCount * stride).fill(null)

  for (let position = inputLength; position >= 0; position--) {
    solutions[tokens.length * stride + position] = position === inputLength ? emptySolution : null

    for (let state = tokens.length - 1; state >= 0; state--) {
      let token = tokens[state]
      let cell = state * stride + position

      if (token.type === ')') {
        solutions[cell] = solutions[(state + 1) * stride + position]
      } else if (token.type === '(') {
        solutions[cell] = betterSolution(
          inputLength,
          hostnameOrder,
          solutions[(token.end + 1) * stride + position],
          solutions[(state + 1) * stride + position],
          budget,
          position,
        )
      } else if (token.type === 'unit') {
        let unit = input.units[position]
        solutions[cell] =
          unit !== undefined && unit.value === token.value && unit.structural === token.structural
            ? solutions[(state + 1) * stride + position + 1]
            : null
      } else if (token.type === ':') {
        let end = position
        while (end < inputLength && !input.units[end].structural) {
          consumeMatchWork(budget, 1)
          end += 1
        }
        let suffix = end === position ? null : solutions[(state + 1) * stride + end]
        solutions[cell] = prependCapture(suffix, {
          type: ':',
          name: token.name,
          begin: position,
          end,
        })
      } else {
        solutions[cell] = solveWildcardCell(
          solutions,
          cell,
          state,
          position,
          inputLength,
          stride,
          token.name,
          hostnameOrder,
          budget,
        )
      }
    }
  }

  let solution = solutions[0]
  if (solution === null) return null
  let result: Array<MatchParamMeta> = []
  for (let capture = solution.captures; capture !== null; capture = capture.next) {
    let value = ''
    for (let p = capture.begin; p < capture.end; p++) {
      value += input.units[p].value
    }
    result.push({
      type: capture.type,
      name: capture.name,
      value,
      begin: offsetAt(input, capture.begin),
      end: offsetAt(input, capture.end),
    })
  }
  return result
}

function solveWildcardCell(
  solutions: ReadonlyArray<Solution | null>,
  cell: number,
  state: number,
  pos: number,
  inputLength: number,
  stride: number,
  name: string,
  hostnameOrder: ReadonlyArray<number> | null,
  budget: MatchWorkBudget,
): Solution | null {
  let consumed: Solution | null = null
  if (pos < inputLength) {
    let next = solutions[cell + 1]
    if (next !== null) {
      let capture = next.captures
      if (capture === null || capture.type !== '*' || capture.name !== name) {
        throw new Error('invalid wildcard continuation')
      }
      consumed = { captures: { ...capture, begin: pos }, captureCount: next.captureCount }
    }
  }
  let exited = prependCapture(solutions[(state + 1) * stride + pos], {
    type: '*',
    name,
    begin: pos,
    end: pos,
  })
  return betterSolution(inputLength, hostnameOrder, consumed, exited, budget, pos)
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
  return compareSolutions(inputLength, hostnameOrder, preferred, alternative, budget, startPos) >= 0
    ? preferred
    : alternative
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
      while (aCap !== null && (aCap.end <= pos || aCap.begin === aCap.end)) aCap = aCap.next
      while (bCap !== null && (bCap.end <= pos || bCap.begin === bCap.end)) bCap = bCap.next
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

function buildHostnameOrder(length: number, isDot: (index: number) => boolean): Array<number> {
  let result: Array<number> = []
  let end = length
  for (let i = length - 1; i >= 0; i--) {
    if (isDot(i)) {
      for (let j = i + 1; j < end; j++) result.push(j)
      end = i
    }
  }
  for (let i = 0; i < end; i++) result.push(i)
  return result
}

function offsetAt(input: CanonicalText, position: number): number {
  return position === input.units.length ? input.length : input.units[position].begin
}
