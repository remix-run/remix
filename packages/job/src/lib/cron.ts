import type { CatchUpPolicy } from './types.ts'

let MAX_MINUTE_ITERATIONS = 1_051_200
let WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

type ParsedCron = {
  minute: Set<number> | null
  hour: Set<number> | null
  dayOfMonth: Set<number> | null
  month: Set<number> | null
  dayOfWeek: Set<number> | null
}

type ZonedParts = {
  minute: number
  hour: number
  dayOfMonth: number
  month: number
  dayOfWeek: number
}

let formatterCache = new Map<string, Intl.DateTimeFormat>()
let parserCache = new Map<string, ParsedCron>()

export function getNextCronRunAt(cron: string, fromMs: number, timeZone = 'UTC'): number {
  let parsed = parseCron(cron)
  let cursor = Math.floor(fromMs / 60000) * 60000 + 60000
  let iteration = 0

  while (iteration < MAX_MINUTE_ITERATIONS) {
    let parts = getZonedParts(cursor, timeZone)

    if (matchesCron(parsed, parts)) {
      return cursor
    }

    cursor += 60000
    iteration += 1
  }

  throw new Error(`Unable to find next cron run for "${cron}" in timezone "${timeZone}"`)
}

export function getCronDispatchCount(
  cron: string,
  timeZone: string,
  catchUp: CatchUpPolicy,
  nextRunAt: number,
  now: number,
): number {
  if (catchUp === 'none') {
    return 0
  }

  if (catchUp === 'one') {
    return 1
  }

  let count = 1
  let cursor = nextRunAt

  while (count < 100) {
    let next = getNextCronRunAt(cron, cursor, timeZone)

    if (next > now) {
      break
    }

    count += 1
    cursor = next
  }

  return count
}

function parseCron(cron: string): ParsedCron {
  let cached = parserCache.get(cron)

  if (cached != null) {
    return cached
  }

  let parts = cron.trim().split(/\s+/)

  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression "${cron}": expected 5 fields`)
  }

  let parsed: ParsedCron = {
    minute: parseField(parts[0], 0, 59, false),
    hour: parseField(parts[1], 0, 23, false),
    dayOfMonth: parseField(parts[2], 1, 31, false),
    month: parseField(parts[3], 1, 12, false),
    dayOfWeek: parseField(parts[4], 0, 7, true),
  }

  parserCache.set(cron, parsed)

  return parsed
}

function parseField(
  field: string,
  minValue: number,
  maxValue: number,
  normalizeSunday: boolean,
): Set<number> | null {
  if (field === '*') {
    return null
  }

  let values = new Set<number>()

  for (let token of field.split(',')) {
    parseToken(token, minValue, maxValue, normalizeSunday, values)
  }

  if (values.size === 0) {
    throw new Error(`Invalid cron field "${field}"`)
  }

  return values
}

function parseToken(
  token: string,
  minValue: number,
  maxValue: number,
  normalizeSunday: boolean,
  output: Set<number>,
): void {
  let [rangePart, stepPart] = token.split('/')
  let step = parseNumber(stepPart, 1)

  if (step <= 0) {
    throw new Error(`Invalid cron step "${token}"`)
  }

  if (rangePart === '*') {
    addRange(output, minValue, maxValue, step, normalizeSunday)
    return
  }

  if (rangePart.includes('-')) {
    let [startText, endText] = rangePart.split('-')
    let start = parseNumber(startText)
    let end = parseNumber(endText)

    if (start > end) {
      throw new Error(`Invalid cron range "${token}"`)
    }

    addRange(output, start, end, step, normalizeSunday, minValue, maxValue)
    return
  }

  let value = parseNumber(rangePart)
  addValue(output, value, normalizeSunday, minValue, maxValue)
}

function addRange(
  output: Set<number>,
  start: number,
  end: number,
  step: number,
  normalizeSunday: boolean,
  minValue?: number,
  maxValue?: number,
): void {
  let effectiveMin = minValue ?? start
  let effectiveMax = maxValue ?? end
  let current = start

  while (current <= end) {
    addValue(output, current, normalizeSunday, effectiveMin, effectiveMax)
    current += step
  }
}

function addValue(
  output: Set<number>,
  value: number,
  normalizeSunday: boolean,
  minValue: number,
  maxValue: number,
): void {
  let normalized = normalizeSunday && value === 7 ? 0 : value

  if (normalized < minValue || normalized > maxValue) {
    throw new Error(`Cron value "${value}" is out of bounds`)
  }

  output.add(normalized)
}

function parseNumber(value: string | undefined, fallback?: number): number {
  if (value == null || value === '') {
    if (fallback != null) {
      return fallback
    }

    throw new Error('Invalid cron token')
  }

  let parsed = Number(value)

  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid cron number "${value}"`)
  }

  return parsed
}

function matchesCron(parsed: ParsedCron, parts: ZonedParts): boolean {
  if (!matchesValue(parsed.minute, parts.minute)) {
    return false
  }

  if (!matchesValue(parsed.hour, parts.hour)) {
    return false
  }

  if (!matchesValue(parsed.month, parts.month)) {
    return false
  }

  let dayOfMonthMatch = matchesValue(parsed.dayOfMonth, parts.dayOfMonth)
  let dayOfWeekMatch = matchesValue(parsed.dayOfWeek, parts.dayOfWeek)
  let dayOfMonthWildcard = parsed.dayOfMonth == null
  let dayOfWeekWildcard = parsed.dayOfWeek == null

  if (dayOfMonthWildcard && dayOfWeekWildcard) {
    return true
  }

  if (dayOfMonthWildcard) {
    return dayOfWeekMatch
  }

  if (dayOfWeekWildcard) {
    return dayOfMonthMatch
  }

  return dayOfMonthMatch || dayOfWeekMatch
}

function matchesValue(values: Set<number> | null, value: number): boolean {
  if (values == null) {
    return true
  }

  return values.has(value)
}

function getZonedParts(timestamp: number, timeZone: string): ZonedParts {
  let formatter = getFormatter(timeZone)
  let values: Partial<ZonedParts> = {}

  for (let part of formatter.formatToParts(new Date(timestamp))) {
    if (part.type === 'minute') {
      values.minute = Number(part.value)
      continue
    }

    if (part.type === 'hour') {
      values.hour = Number(part.value)
      continue
    }

    if (part.type === 'day') {
      values.dayOfMonth = Number(part.value)
      continue
    }

    if (part.type === 'month') {
      values.month = Number(part.value)
      continue
    }

    if (part.type === 'weekday') {
      values.dayOfWeek = WEEKDAY_MAP[part.value]
    }
  }

  if (
    values.minute == null ||
    values.hour == null ||
    values.dayOfMonth == null ||
    values.month == null ||
    values.dayOfWeek == null
  ) {
    throw new Error(`Unable to parse zoned date parts for timezone "${timeZone}"`)
  }

  return values as ZonedParts
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let cached = formatterCache.get(timeZone)

  if (cached != null) {
    return cached
  }

  let formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    minute: 'numeric',
    hour: 'numeric',
    day: 'numeric',
    month: 'numeric',
  })

  formatterCache.set(timeZone, formatter)

  return formatter
}
