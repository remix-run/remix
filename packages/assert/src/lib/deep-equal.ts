type Key = string | symbol
type Memo = WeakMap<object, WeakSet<object>>

function isObject(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function'
}

function getTag(value: object): string {
  return Object.prototype.toString.call(value)
}

function hasOwn(value: object, key: Key): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function getEnumerableKeys(value: object, skip: ReadonlySet<Key> = new Set()): Key[] {
  let keys: Key[] = Object.keys(value)
  for (let symbol of Object.getOwnPropertySymbols(value)) {
    if (Object.prototype.propertyIsEnumerable.call(value, symbol)) {
      keys.push(symbol)
    }
  }

  return keys.filter((key) => !skip.has(key))
}

function hasCompared(memo: Memo, actual: object, expected: object): boolean {
  return memo.get(actual)?.has(expected) === true
}

function rememberComparison(memo: Memo, actual: object, expected: object): void {
  let expectedSet = memo.get(actual)
  if (expectedSet === undefined) {
    expectedSet = new WeakSet()
    memo.set(actual, expectedSet)
  }
  expectedSet.add(expected)
}

function compareArrayBuffer(actual: ArrayBufferLike, expected: ArrayBufferLike): boolean {
  if (actual.byteLength !== expected.byteLength) return false

  let actualBytes = new Uint8Array(actual)
  let expectedBytes = new Uint8Array(expected)

  for (let index = 0; index < actualBytes.length; index++) {
    if (actualBytes[index] !== expectedBytes[index]) return false
  }

  return true
}

function getViewBytes(value: ArrayBufferView): Uint8Array {
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
}

function compareArrayBufferView(actual: ArrayBufferView, expected: ArrayBufferView): boolean {
  if (actual.constructor !== expected.constructor) return false
  if (actual.byteLength !== expected.byteLength) return false

  let actualBytes = getViewBytes(actual)
  let expectedBytes = getViewBytes(expected)

  for (let index = 0; index < actualBytes.length; index++) {
    if (actualBytes[index] !== expectedBytes[index]) return false
  }

  return true
}

function compareOwnEnumerable(
  actual: object,
  expected: object,
  memo: Memo,
  skip: ReadonlySet<Key> = new Set(),
): boolean {
  let actualKeys = getEnumerableKeys(actual, skip)
  let expectedKeys = getEnumerableKeys(expected, skip)

  if (actualKeys.length !== expectedKeys.length) return false

  for (let key of actualKeys) {
    if (!hasOwn(expected, key)) return false
    if (
      !compare((actual as Record<Key, unknown>)[key], (expected as Record<Key, unknown>)[key], memo)
    ) {
      return false
    }
  }

  return true
}

function compareMap(
  actual: Map<unknown, unknown>,
  expected: Map<unknown, unknown>,
  memo: Memo,
): boolean {
  if (actual.size !== expected.size) return false

  let unmatched = Array.from(expected.entries())

  for (let [actualKey, actualValue] of actual) {
    let matchIndex = unmatched.findIndex(
      ([expectedKey, expectedValue]) =>
        compare(actualKey, expectedKey, memo) && compare(actualValue, expectedValue, memo),
    )

    if (matchIndex === -1) return false
    unmatched.splice(matchIndex, 1)
  }

  return true
}

function compareSet(actual: Set<unknown>, expected: Set<unknown>, memo: Memo): boolean {
  if (actual.size !== expected.size) return false

  let unmatched = Array.from(expected.values())

  for (let actualValue of actual) {
    let matchIndex = unmatched.findIndex((expectedValue) =>
      compare(actualValue, expectedValue, memo),
    )

    if (matchIndex === -1) return false
    unmatched.splice(matchIndex, 1)
  }

  return true
}

function compareBoxedPrimitive(actual: object, expected: object): boolean {
  try {
    return Object.is(
      (actual as { valueOf(): unknown }).valueOf(),
      (expected as { valueOf(): unknown }).valueOf(),
    )
  } catch {
    return false
  }
}

function compareError(actual: Error, expected: Error, memo: Memo): boolean {
  if (actual.name !== expected.name) return false
  if (actual.message !== expected.message) return false

  let actualHasCause = hasOwn(actual, 'cause')
  let expectedHasCause = hasOwn(expected, 'cause')
  if (actualHasCause !== expectedHasCause) return false
  if (
    actualHasCause &&
    !compare(
      (actual as Error & { cause?: unknown }).cause,
      (expected as Error & { cause?: unknown }).cause,
      memo,
    )
  ) {
    return false
  }

  let actualHasErrors = hasOwn(actual, 'errors')
  let expectedHasErrors = hasOwn(expected, 'errors')
  if (actualHasErrors !== expectedHasErrors) return false
  if (
    actualHasErrors &&
    !compare(
      (actual as Error & { errors?: unknown }).errors,
      (expected as Error & { errors?: unknown }).errors,
      memo,
    )
  ) {
    return false
  }

  return compareOwnEnumerable(
    actual,
    expected,
    memo,
    new Set(['cause', 'errors', 'message', 'name', 'stack']),
  )
}

function compare(actual: unknown, expected: unknown, memo: Memo): boolean {
  if (Object.is(actual, expected)) return true
  if (!isObject(actual) || !isObject(expected)) return false
  if (typeof actual !== typeof expected) return false
  if (typeof actual === 'function') return false

  if (hasCompared(memo, actual, expected)) return true

  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) {
    return false
  }

  let actualTag = getTag(actual)
  if (actualTag !== getTag(expected)) return false

  rememberComparison(memo, actual, expected)

  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false
    if (actual.length !== expected.length) return false
    return compareOwnEnumerable(actual, expected, memo)
  }

  if (actual instanceof Date && expected instanceof Date) {
    return (
      Object.is(actual.getTime(), expected.getTime()) &&
      compareOwnEnumerable(actual, expected, memo)
    )
  }

  if (actual instanceof RegExp && expected instanceof RegExp) {
    return (
      actual.source === expected.source &&
      actual.flags === expected.flags &&
      actual.lastIndex === expected.lastIndex &&
      compareOwnEnumerable(actual, expected, memo)
    )
  }

  if (actual instanceof Error && expected instanceof Error) {
    return compareError(actual, expected, memo)
  }

  if (actual instanceof Map && expected instanceof Map) {
    return compareMap(actual, expected, memo) && compareOwnEnumerable(actual, expected, memo)
  }

  if (actual instanceof Set && expected instanceof Set) {
    return compareSet(actual, expected, memo) && compareOwnEnumerable(actual, expected, memo)
  }

  if (actualTag === '[object ArrayBuffer]' || actualTag === '[object SharedArrayBuffer]') {
    return compareArrayBuffer(actual as ArrayBufferLike, expected as ArrayBufferLike)
  }

  if (ArrayBuffer.isView(actual) || ArrayBuffer.isView(expected)) {
    if (!ArrayBuffer.isView(actual) || !ArrayBuffer.isView(expected)) return false
    return compareArrayBufferView(actual, expected) && compareOwnEnumerable(actual, expected, memo)
  }

  if (
    actualTag === '[object Boolean]' ||
    actualTag === '[object Number]' ||
    actualTag === '[object String]' ||
    actualTag === '[object BigInt]' ||
    actualTag === '[object Symbol]'
  ) {
    return compareBoxedPrimitive(actual, expected) && compareOwnEnumerable(actual, expected, memo)
  }

  if (
    actualTag === '[object Promise]' ||
    actualTag === '[object WeakMap]' ||
    actualTag === '[object WeakSet]'
  ) {
    return false
  }

  if (actual instanceof URL && expected instanceof URL) {
    return String(actual) === String(expected) && compareOwnEnumerable(actual, expected, memo)
  }

  if (actual instanceof URLSearchParams && expected instanceof URLSearchParams) {
    return String(actual) === String(expected) && compareOwnEnumerable(actual, expected, memo)
  }

  return compareOwnEnumerable(actual, expected, memo)
}

export function isDeepEqual(actual: unknown, expected: unknown): boolean {
  return compare(actual, expected, new WeakMap())
}
