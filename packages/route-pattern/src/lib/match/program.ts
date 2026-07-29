import type { PartPattern, PartPatternToken } from '../route-pattern.ts'
import type { MatchParamMeta } from './types.ts'
import { checkMatcherLimit } from './limits.ts'

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
  readonly isStatic: boolean
  readonly staticPrefix: ReadonlyArray<Unit>
  readonly staticSuffix: ReadonlyArray<Unit>
  readonly staticAnchor: ReadonlyArray<Unit>
}

type Capture = {
  readonly type: ':' | '*'
  readonly name: string
  readonly begin: number
  readonly end: number
}

type Solution = {
  readonly captures: ReadonlyArray<Capture>
}

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
    isStatic: tokens.every((token) => token.type === 'text' || token.type === 'separator'),
    staticPrefix,
    staticSuffix,
    staticAnchor,
  }
}

export function hasStaticSuffix(program: PartProgram, input: CanonicalText): boolean {
  let offset = input.units.length - program.staticSuffix.length
  if (offset < 0) return false
  for (let i = 0; i < program.staticSuffix.length; i++) {
    if (!unitsEqual(input.units[offset + i], program.staticSuffix[i])) return false
  }
  return true
}

export function hasStaticPrefix(program: PartProgram, input: CanonicalText): boolean {
  if (program.staticPrefix.length > input.units.length) return false
  for (let i = 0; i < program.staticPrefix.length; i++) {
    if (!unitsEqual(input.units[i], program.staticPrefix[i])) return false
  }
  return true
}

export function hasStaticAnchor(program: PartProgram, input: CanonicalText): boolean {
  if (program.staticAnchor.length === 0) return true
  for (let position = 0; position + program.staticAnchor.length <= input.units.length; position++) {
    if (matchUnits(input.units, position, program.staticAnchor) !== null) return true
  }
  return false
}

export function canonicalizeUrlPart(
  text: string,
  type: PartPattern['type'],
  options?: { ignoreCase?: boolean },
): CanonicalText | null {
  return canonicalizeText(text, type, { ...options, strict: true, pattern: false })
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
  let structuralChars =
    type === 'hostname' ? new Set(['.']) : options.pattern ? new Set(['.']) : new Set(['/', '.'])
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
    if (!structuralChars.has(char)) {
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
  options: { maxActiveStates: number },
): ReadonlyArray<MatchParamMeta> | null {
  let stateCount = program.tokens.length + 1
  let inputLength = input.units.length
  checkMatcherLimit('maxActiveStates', options.maxActiveStates, stateCount * (inputLength + 1))
  if (program.isStatic) {
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
  let solutions: Array<Array<Solution | null>> = Array.from({ length: stateCount }, () =>
    Array.from({ length: inputLength + 1 }, () => null),
  )

  for (let position = inputLength; position >= 0; position--) {
    solutions[program.tokens.length][position] = position === inputLength ? { captures: [] } : null

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
        solutions[state][position] = betterSolution(program.type, input, omitted, included)
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
          let [capture, ...rest] = next.captures
          if (capture === undefined || capture.type !== '*' || capture.name !== token.name) {
            throw new Error('invalid wildcard continuation')
          }
          consumed = { captures: [{ ...capture, begin: position }, ...rest] }
        }
      }
      let exited = prependCapture(solutions[state + 1][position], {
        type: token.type,
        name: token.name,
        begin: position,
        end: position,
      })
      solutions[state][position] = betterSolution(program.type, input, consumed, exited)
    }
  }

  let solution = solutions[0][0]
  if (solution === null) return null
  return solution.captures.map((capture) => ({
    type: capture.type,
    name: capture.name,
    value: input.units
      .slice(capture.begin, capture.end)
      .map((unit) => unit.value)
      .join(''),
    begin: offsetAt(input, capture.begin),
    end: offsetAt(input, capture.end),
  }))
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

function prependCapture(solution: Solution | null, capture: Capture): Solution | null {
  return solution === null ? null : { captures: [capture, ...solution.captures] }
}

function betterSolution(
  type: PartPattern['type'],
  input: CanonicalText,
  preferred: Solution | null,
  alternative: Solution | null,
): Solution | null {
  if (preferred === null) return alternative
  if (alternative === null) return preferred
  let comparison = compareSolutions(type, input.units, preferred, alternative)
  return comparison >= 0 ? preferred : alternative
}

function compareSolutions(
  type: PartPattern['type'],
  input: ReadonlyArray<Unit>,
  a: Solution,
  b: Solution,
): -1 | 0 | 1 {
  let aEncoding = encodeSpecificity(input.length, a.captures)
  let bEncoding = encodeSpecificity(input.length, b.captures)
  let positions = type === 'hostname' ? hostnamePositions(input) : input.map((_, index) => index)

  for (let position of positions) {
    if (aEncoding[position] < bEncoding[position]) return 1
    if (aEncoding[position] > bEncoding[position]) return -1
  }
  if (a.captures.length < b.captures.length) return 1
  if (a.captures.length > b.captures.length) return -1
  return 0
}

function encodeSpecificity(length: number, captures: ReadonlyArray<Capture>): Uint8Array {
  let encoding = new Uint8Array(length)
  for (let capture of captures) {
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
