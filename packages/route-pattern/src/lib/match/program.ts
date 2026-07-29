import type { PartPattern, PartPatternToken } from '../route-pattern.ts'
import type { MatchParamMeta } from './types.ts'
import { consumeMatchStates, type MatchStateBudget } from './limits.ts'

type Unit = {
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
  | { readonly type: 'text'; readonly unit: Unit }
  | { readonly type: 'separator'; readonly unit: Unit }
  | Extract<PartPatternToken, { type: ':' | '*' | '(' | ')' }>

export type PartProgram = {
  readonly type: PartPattern['type']
  readonly tokens: ReadonlyArray<CompiledToken>
  readonly optionals: ReadonlyMap<number, number>
  readonly captureNames: ReadonlySet<string>
  readonly matchKind: 'static' | 'linear' | 'state'
  readonly staticPrefix: ReadonlyArray<Unit>
  readonly staticSuffix: ReadonlyArray<Unit>
  readonly staticAnchor: ReadonlyArray<Unit>
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

export function compilePart(part: PartPattern, options?: { ignoreCase?: boolean }): PartProgram {
  let tokens: Array<CompiledToken> = []
  let optionals = new Map<number, number>()
  let optionalStack: Array<number> = []
  let captureNames = new Set<string>()

  for (let token of part.tokens) {
    if (token.type === 'text') {
      for (let unit of canonicalizePatternText(token.text, part.type, options).units) {
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
      if ((token.type === ':' || token.type === '*') && token.name !== '*') {
        captureNames.add(token.name)
      }
    }
  }

  let staticPrefix: Array<Unit> = []
  for (let token of tokens) {
    if (token.type === 'text' || token.type === 'separator') {
      staticPrefix.push(token.unit)
    } else {
      break
    }
  }

  let staticSuffix: Array<Unit> = []
  for (let i = tokens.length - 1; i >= 0; i--) {
    let token = tokens[i]
    if (token.type === 'text' || token.type === 'separator') {
      staticSuffix.unshift(token.unit)
    } else {
      break
    }
  }

  let staticAnchor: Array<Unit> = []
  let staticRun: Array<Unit> = []
  let optionalDepth = 0
  for (let token of tokens) {
    if (token.type === '(') {
      if (staticRun.length > staticAnchor.length) staticAnchor = staticRun
      staticRun = []
      optionalDepth += 1
    } else if (token.type === ')') {
      optionalDepth -= 1
    } else if ((token.type === 'text' || token.type === 'separator') && optionalDepth === 0) {
      staticRun.push(token.unit)
    } else if (optionalDepth === 0) {
      if (staticRun.length > staticAnchor.length) staticAnchor = staticRun
      staticRun = []
    }
  }
  if (staticRun.length > staticAnchor.length) staticAnchor = staticRun

  return {
    type: part.type,
    tokens,
    optionals,
    captureNames,
    matchKind: getMatchKind(tokens),
    staticPrefix,
    staticSuffix,
    staticAnchor,
  }
}

function getMatchKind(tokens: ReadonlyArray<CompiledToken>): PartProgram['matchKind'] {
  let result: PartProgram['matchKind'] = 'static'
  for (let token of tokens) {
    if (token.type === '*' || token.type === '(' || token.type === ')') return 'state'
    if (token.type === ':') result = 'linear'
  }
  return result
}

export function hasStaticSuffix(
  program: PartProgram,
  input: CanonicalText,
  budget: MatchStateBudget,
): boolean {
  let offset = input.units.length - program.staticSuffix.length
  if (offset < 0) return false
  consumeMatchStates(budget, program.staticSuffix.length)
  for (let i = 0; i < program.staticSuffix.length; i++) {
    if (!unitsEqual(input.units[offset + i], program.staticSuffix[i])) return false
  }
  return true
}

export function hasStaticPrefix(
  program: PartProgram,
  input: CanonicalText,
  budget: MatchStateBudget,
): boolean {
  if (program.staticPrefix.length > input.units.length) return false
  consumeMatchStates(budget, program.staticPrefix.length)
  for (let i = 0; i < program.staticPrefix.length; i++) {
    if (!unitsEqual(input.units[i], program.staticPrefix[i])) return false
  }
  return true
}

export function hasStaticAnchor(
  program: PartProgram,
  input: CanonicalText,
  budget: MatchStateBudget,
): boolean {
  if (program.staticAnchor.length === 0) return true
  for (let position = 0; position + program.staticAnchor.length <= input.units.length; position++) {
    consumeMatchStates(budget, program.staticAnchor.length)
    if (matchUnits(input.units, position, program.staticAnchor) !== null) return true
  }
  return false
}

export function canonicalizeUrlPart(
  text: string,
  type: PartPattern['type'],
  options: { budget: MatchStateBudget; ignoreCase?: boolean },
): CanonicalText | null {
  consumeMatchStates(options.budget, text.length)
  return canonicalizeText(text, type, {
    ignoreCase: options.ignoreCase,
    strict: true,
    pattern: false,
  })
}

function canonicalizePatternText(
  text: string,
  type: PartPattern['type'],
  options?: { ignoreCase?: boolean },
): CanonicalText {
  let result = canonicalizeText(text, type, { ...options, strict: false, pattern: true })
  if (result === null) throw new Error('pattern text canonicalization failed')
  return result
}

function canonicalizeText(
  text: string,
  type: PartPattern['type'],
  options: { ignoreCase?: boolean; strict: boolean; pattern: boolean },
): CanonicalText | null {
  let units: Array<Unit> = []
  let offset = 0
  let chunk = ''

  let appendChunk = (): boolean => {
    if (chunk === '') return true
    let decoded: string
    try {
      decoded = decodeURIComponent(chunk)
    } catch (error) {
      if (!(error instanceof URIError)) throw error
      if (options.strict) return false
      decoded = chunk
    }
    if (options.ignoreCase) decoded = decoded.toLowerCase()
    for (let value of decoded) {
      let encoded = encodeDataUnit(value, type)
      units.push({ value, structural: false, begin: offset, end: offset + encoded.length })
      offset += encoded.length
    }
    chunk = ''
    return true
  }

  for (let char of text) {
    let structural = char === '.' || (type === 'pathname' && !options.pattern && char === '/')
    if (!structural) {
      chunk += char
      continue
    }
    if (!appendChunk()) return null
    units.push({ value: char, structural: true, begin: offset, end: offset + char.length })
    offset += char.length
  }
  if (!appendChunk()) return null

  return { units, length: offset }
}

function encodeDataUnit(value: string, type: PartPattern['type']): string {
  if (type === 'pathname' && value === '.') return '%2E'
  if (type === 'pathname' && value === '/') return '%2F'
  return type === 'pathname' ? encodeURIComponent(value) : value
}

export function matchPart(
  program: PartProgram,
  input: CanonicalText,
  budget: MatchStateBudget,
): ReadonlyArray<MatchParamMeta> | null {
  let stateCount = program.tokens.length + 1
  let inputLength = input.units.length
  if (program.matchKind === 'static') {
    consumeMatchStates(budget, stateCount + inputLength)
    if (program.tokens.length !== inputLength) return null
    for (let position = 0; position < inputLength; position++) {
      let token = program.tokens[position]
      if (
        (token.type !== 'text' && token.type !== 'separator') ||
        !unitsEqual(input.units[position], token.unit)
      ) {
        return null
      }
    }
    return []
  }
  if (program.matchKind === 'linear') {
    consumeMatchStates(budget, stateCount + inputLength)
    return matchLinearPart(program, input)
  }
  consumeMatchStates(budget, stateCount * (inputLength + 1))
  let hostnameOrder = program.type === 'hostname' ? hostnamePositions(input.units) : null
  let solutions: Array<Array<Solution | null>> = Array.from({ length: stateCount }, () =>
    Array.from({ length: inputLength + 1 }, () => null),
  )

  for (let position = inputLength; position >= 0; position--) {
    solutions[program.tokens.length][position] = position === inputLength ? emptySolution : null

    for (let state = program.tokens.length - 1; state >= 0; state--) {
      let token = program.tokens[state]

      if (token.type === ')') {
        solutions[state][position] = solutions[state + 1][position]
        continue
      }

      if (token.type === '(') {
        let end = program.optionals.get(state)
        if (end === undefined) throw new Error('missing optional end')
        let omitted = solutions[end + 1][position]
        let included = solutions[state + 1][position]
        solutions[state][position] = betterSolution(inputLength, hostnameOrder, omitted, included)
        continue
      }

      if (token.type === 'text') {
        solutions[state][position] =
          input.units[position] !== undefined && unitsEqual(input.units[position], token.unit)
            ? solutions[state + 1][position + 1]
            : null
        continue
      }

      if (token.type === 'separator') {
        let unit = input.units[position]
        solutions[state][position] =
          unit !== undefined && unitsEqual(unit, token.unit)
            ? solutions[state + 1][position + 1]
            : null
        continue
      }

      if (token.type === ':') {
        let end = position
        while (end < inputLength && !input.units[end].structural) end += 1
        let suffix = end === position ? null : solutions[state + 1][end]
        solutions[state][position] = prependCapture(suffix, {
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
        let next = solutions[state][position + 1]
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
      let exited = prependCapture(solutions[state + 1][position], {
        type: token.type,
        name: token.name,
        begin: position,
        end: position,
      })
      solutions[state][position] = betterSolution(inputLength, hostnameOrder, consumed, exited)
    }
  }

  let solution = solutions[0][0]
  if (solution === null) return null
  let result: Array<MatchParamMeta> = []
  for (let capture = solution.captures; capture !== null; capture = capture.next) {
    result.push(toMatchParamMeta(input, capture))
  }
  return result
}

function matchLinearPart(
  program: PartProgram,
  input: CanonicalText,
): ReadonlyArray<MatchParamMeta> | null {
  let captures: Array<MatchParamMeta> = []
  let position = 0

  for (let token of program.tokens) {
    if (token.type === 'text' || token.type === 'separator') {
      let unit = input.units[position]
      if (unit === undefined || !unitsEqual(unit, token.unit)) return null
      position += 1
      continue
    }
    if (token.type !== ':') throw new Error(`unexpected linear token: ${token.type}`)

    let begin = position
    while (position < input.units.length && !input.units[position].structural) position += 1
    if (position === begin) return null
    captures.push(
      toMatchParamMeta(input, {
        type: token.type,
        name: token.name,
        begin,
        end: position,
        next: null,
      }),
    )
  }

  return position === input.units.length ? captures : null
}

function toMatchParamMeta(input: CanonicalText, capture: CaptureNode): MatchParamMeta {
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

function matchUnits(
  input: ReadonlyArray<Unit>,
  position: number,
  expected: ReadonlyArray<Unit>,
): number | null {
  if (position + expected.length > input.length) return null
  for (let i = 0; i < expected.length; i++) {
    if (!unitsEqual(input[position + i], expected[i])) return null
  }
  return position + expected.length
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
): Solution | null {
  if (preferred === null) return alternative
  if (alternative === null) return preferred
  let comparison = compareSolutions(inputLength, hostnameOrder, preferred, alternative)
  return comparison >= 0 ? preferred : alternative
}

function compareSolutions(
  inputLength: number,
  hostnameOrder: ReadonlyArray<number> | null,
  a: Solution,
  b: Solution,
): -1 | 0 | 1 {
  if (hostnameOrder === null) {
    let aCapture = a.captures
    let bCapture = b.captures
    for (let position = 0; position < inputLength; position++) {
      while (aCapture !== null && aCapture.end <= position) aCapture = aCapture.next
      while (bCapture !== null && bCapture.end <= position) bCapture = bCapture.next
      let aSpecificity = captureSpecificityAt(aCapture, position)
      let bSpecificity = captureSpecificityAt(bCapture, position)
      if (aSpecificity < bSpecificity) return 1
      if (aSpecificity > bSpecificity) return -1
    }
  } else {
    let aEncoding = encodeSpecificity(inputLength, a.captures)
    let bEncoding = encodeSpecificity(inputLength, b.captures)
    for (let position of hostnameOrder) {
      if (aEncoding[position] < bEncoding[position]) return 1
      if (aEncoding[position] > bEncoding[position]) return -1
    }
  }
  if (a.captureCount < b.captureCount) return 1
  if (a.captureCount > b.captureCount) return -1
  return 0
}

function captureSpecificityAt(capture: CaptureNode | null, position: number): 0 | 1 | 2 {
  if (capture === null || capture.begin > position) return 0
  return capture.type === ':' ? 1 : 2
}

function encodeSpecificity(length: number, captures: CaptureNode | null): Uint8Array {
  let encoding = new Uint8Array(length)
  for (let capture = captures; capture !== null; capture = capture.next) {
    encoding.fill(capture.type === ':' ? 1 : 2, capture.begin, capture.end)
  }
  return encoding
}

function hostnamePositions(input: ReadonlyArray<Unit>): Array<number> {
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

export function unitKey(unit: Pick<Unit, 'value' | 'structural'>): string {
  return `${unit.structural ? 's' : 'd'}:${unit.value}`
}
