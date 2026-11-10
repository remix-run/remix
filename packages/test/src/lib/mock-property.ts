import { registerMockDescriptor, restoreMockDescriptor } from './mock-restoration.ts'

/** A recorded read or write of a mocked property. */
export interface MockPropertyAccess<value = unknown> {
  /** Whether the property was read or written. */
  type: 'get' | 'set'
  /** The value returned by the read or stored by the write. */
  value: value
  /** An error capturing the access stack. */
  stack: Error
}

/** Controls a mocked data property and records its reads and writes. */
export interface MockPropertyContext<value = unknown> {
  /** A new array of recorded accesses; the records themselves are shared. */
  readonly accesses: MockPropertyAccess<value>[]
  /**
   * Counts recorded reads and writes.
   * @returns The number of accesses since the last history reset.
   */
  accessCount(): number
  /**
   * Writes a new value and records the write. Read-only properties reject writes without
   * recording an access or consuming a scheduled override.
   * @param value The value to write, subject to any override for this access.
   */
  mockImplementation(value: value): void
  /**
   * Overrides one read or write. A read uses the value once; a write stores it instead of
   * the assigned value. Repeated registrations for an index replace its override.
   * @param value The value to use for the selected access.
   * @param onAccess A safe integer at or after the next zero-based access index
   * (defaults to the next access).
   */
  mockImplementationOnce(value: value, onAccess?: number): void
  /** Clears history and restarts indices, retaining the stored value and unused overrides. */
  resetAccesses(): void
  /**
   * Restores the original descriptor and value. Later calls preserve changes made after
   * restoration unless another spy has reinstalled this mock. The proxy retains its context.
   */
  restore(): void
}

/**
 * A proxy of the target whose `.mock` read exposes the property context, shadowing any
 * target field named `mock`. Other reads and writes forward to the target.
 *
 * JavaScript proxy invariants prevent reading this context if the target's `mock` field
 * is a non-configurable, non-writable data property or a non-configurable accessor without a getter.
 */
export type MockProperty<target extends object, key extends keyof target> = Omit<target, 'mock'> & {
  mock: MockPropertyContext<target[key]>
}

const createObject = Object.create
const defineProperty = Object.defineProperty
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
const isSafeInteger = Number.isSafeInteger

export function createPropertyMock<target extends object, key extends keyof target>(
  object: target,
  propertyName: key,
  values: [value?: target[key]],
): { property: MockProperty<target, key>; restore(): void } {
  if (object === null || typeof object !== 'object' || Array.isArray(object)) {
    throw new TypeError('object must be a non-array object')
  }
  if (typeof propertyName !== 'string' && typeof propertyName !== 'symbol') {
    throw new TypeError('propertyName must be a string or symbol')
  }
  let descriptor = getOwnPropertyDescriptor(object, propertyName)
  if (!descriptor) throw new TypeError('propertyName must be an existing own data property')
  if (!descriptor.configurable) throw new TypeError('propertyName must be configurable')
  if (!('value' in descriptor)) {
    throw new TypeError('Use mock.getter() or mock.setter() to mock an accessor property')
  }

  let value = values.length > 0 ? values[0] : descriptor.value
  let accesses: MockPropertyAccess<target[key]>[] = []
  let onceValues: { [index: number]: { value: target[key] } | undefined } = createObject(null)
  let restored = false

  function read(): target[key] {
    return access('get', value)
  }

  function access(type: 'get' | 'set', fallback: target[key]): target[key] {
    let index = accesses.length
    let override = onceValues[index]
    let next = override ? override.value : fallback
    delete onceValues[index]
    let record = { __proto__: null, type, value: next, stack: new Error() }
    accesses.push(record)
    return next
  }

  let context: MockPropertyContext<target[key]> = {
    get accesses() {
      return accesses.slice()
    },
    accessCount() {
      return accesses.length
    },
    mockImplementation(next) {
      if (!descriptor.writable) throw new TypeError('propertyName cannot be set')
      value = access('set', next)
    },
    mockImplementationOnce(next, onAccess) {
      let index = onAccess ?? accesses.length
      if (typeof index !== 'number') throw new TypeError('onAccess must be a number')
      if (!isSafeInteger(index) || index < accesses.length) {
        throw new RangeError('onAccess must be an integer at or after the next access index')
      }
      onceValues[index] = { value: next }
    },
    resetAccesses() {
      accesses = []
    },
    restore() {
      if (restored) {
        let current = getOwnPropertyDescriptor(object, propertyName)
        // An accessor spy may have reinstalled this already-restored property mock.
        if (current?.get !== read && current?.set !== context.mockImplementation) return
      }
      restoreMockDescriptor(object, propertyName, descriptor)
      restored = true
    },
  }

  let restoration = {
    object,
    propertyName,
    descriptor,
    isRestored: () => restored,
  }
  registerMockDescriptor(read, 'get', restoration)
  registerMockDescriptor(context.mockImplementation, 'set', restoration)

  defineProperty(object, propertyName, {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get: read,
    set: context.mockImplementation,
  })

  let property = new Proxy(object, {
    get(target, key, receiver) {
      return key === 'mock' ? context : Reflect.get(target, key, receiver)
    },
  })
  // Only the proxy's mock read differs from the target's public shape.
  return { property: property as MockProperty<target, key>, restore: context.restore }
}
