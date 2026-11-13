import { createPropertyMock } from './mock-property.ts'
import type { MockProperty } from './mock-property.ts'
import {
  getMockDescriptor,
  registerMockDescriptor,
  restoreMockDescriptor,
} from './mock-restoration.ts'

/**
 * Selects an accessor for the fourth argument to `mock.method()`. Only `getter` and
 * `setter` are supported; Node's third-argument options shorthand and `times` are not.
 */
export interface MockMethodOptions {
  /** Mock the getter. Cannot be combined with `setter: true`. */
  getter?: boolean
  /** Mock the setter. Cannot be combined with `getter: true`. */
  setter?: boolean
}

type MethodImplementation<method> = method extends (...args: infer args) => unknown
  ? (...args: args) => unknown
  : never

/** Records the arguments, return value, and any thrown error for a single call. */
export interface MockCall<Args extends unknown[] = unknown[], Result = unknown> {
  /** Arguments supplied to this call. */
  arguments: Args
  /** The returned value, including an unawaited promise for async calls. */
  result?: Result
  /** The value thrown synchronously by this call. */
  error?: unknown
}

/**
 * Metadata attached to every mock/spy function via its `.mock` property.
 * Calls are recorded before the implementation runs, including reentrant calls.
 */
export interface MockContext<
  Args extends unknown[] = unknown[],
  Result = unknown,
  implementation extends (...args: never[]) => unknown = (...args: Args) => Result,
> {
  /** Live call history. `resetCalls()` replaces this array with a fresh one. */
  calls: MockCall<Args, Result>[]
  /**
   * Changes the default implementation without clearing scheduled overrides.
   * @param implementation A replacement preserving the original function's full signature.
   */
  mockImplementation(implementation: implementation): void
  /**
   * Replaces the implementation for one call, replacing any override at that index.
   * @param implementation A replacement preserving the original function's full signature.
   * @param onCall Zero-based safe integer index at or after the next call (defaults to the next call).
   */
  mockImplementationOnce(implementation: implementation, onCall?: number): void
  /** Clears call history and resets indices without changing implementations or pending overrides. */
  resetCalls(): void
  /**
   * Counts calls in the live history, including invocations still executing.
   * @returns The length of the current call history.
   */
  callCount(): number
  /**
   * Restores a method's original value and any own descriptor, or a standalone mock's original default.
   * Restoring a method spy skips previously restored spies on the same property.
   * Retains call history and pending overrides; retained method spies remain callable.
   */
  restore(): void
}

/** A function with call history and implementation controls on its `.mock` property. */
export type MockFunction<T extends (...args: any[]) => any = (...args: any[]) => any> = T & {
  /** Call history and implementation controls for this function. */
  mock: MockContext<Parameters<T>, ReturnType<T>, T>
}

// Mocks may replace the built-ins used to create, install, and restore other mocks.
const createObject = Object.create
const defineProperty = Object.defineProperty
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
const getPrototypeOf = Object.getPrototypeOf
const isArray = Array.isArray
const isSafeInteger = Number.isSafeInteger
const setProperty = Reflect.set
const deleteProperty = Reflect.deleteProperty
const getProperty = Reflect.get

// A required implementation preserves generic signatures during type inference.
function createMockFn<T extends (...args: any[]) => any>(impl: T): MockFunction<T>
function createMockFn<T extends (...args: any[]) => any>(impl?: T): MockFunction<T>
function createMockFn<T extends (...args: any[]) => any>(impl?: T): MockFunction<T> {
  let original = impl
  let implementation = impl
  let overrides: { [index: number]: T | undefined } = createObject(null)

  let fn = function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
    let index = fn.mock.calls.length
    let current = overrides[index] ?? implementation
    delete overrides[index]
    let call: MockCall<Parameters<T>, ReturnType<T>> = { arguments: args }
    fn.mock.calls.push(call)
    if (current) {
      try {
        let result = current.apply(this, args)
        call.result = result
        return result
      } catch (error) {
        call.error = error
        throw error
      }
    }
    return undefined as ReturnType<T>
  } as MockFunction<T>

  fn.mock = {
    calls: [],
    mockImplementation(value) {
      if (typeof value !== 'function') throw new TypeError('implementation must be a function')
      implementation = value
    },
    mockImplementationOnce(value, onCall) {
      if (typeof value !== 'function') throw new TypeError('implementation must be a function')
      let index = onCall ?? fn.mock.calls.length
      if (typeof index !== 'number') throw new TypeError('onCall must be a number')
      if (!isSafeInteger(index) || index < fn.mock.calls.length) {
        throw new RangeError('onCall must be a safe integer at or after the next call index')
      }
      overrides[index] = value
    },
    resetCalls() {
      fn.mock.calls = []
    },
    callCount() {
      return fn.mock.calls.length
    },
    restore() {
      implementation = original
    },
  }
  return fn
}

type Method<target, key extends keyof target> = [
  Extract<target[key], (...args: never[]) => unknown>,
] extends [never]
  ? (...args: any[]) => any
  : Extract<target[key], (...args: never[]) => unknown>

type MethodMock<method extends (...args: any[]) => any> = ((...args: any[]) => any) & {
  mock: Omit<MockFunction['mock'], 'mockImplementation' | 'mockImplementationOnce'> &
    Pick<
      MockContext<Parameters<method>, ReturnType<method>, method>,
      'mockImplementation' | 'mockImplementationOnce'
    >
}

interface MethodRestoration {
  object: object
  method: PropertyKey
  original: unknown
  restored: boolean
  restoreOriginal(): void
}

// Worker bootstrap and transformed test modules can load separate copies.
const restorationsKey = Symbol.for('remix.test.methodRestorations')
const realm = globalThis as typeof globalThis & {
  [restorationsKey]?: WeakMap<object, MethodRestoration>
}
const methodRestorations = (realm[restorationsKey] ??= new WeakMap())
const getMethodRestoration = methodRestorations.get.bind(methodRestorations)
const setMethodRestoration = methodRestorations.set.bind(methodRestorations)

function trackRestoration(value: object, restoration: MethodRestoration): () => void {
  setMethodRestoration(value, restoration)
  return () => {
    let target = restoration
    // Skip replacements that have already been restored beneath a newer spy.
    while (typeof target.original === 'function') {
      let previous = getMethodRestoration(target.original)
      if (
        !previous?.restored ||
        previous.object !== target.object ||
        previous.method !== target.method
      )
        break
      target = previous
    }
    target.restoreOriginal()
    restoration.restored = true
  }
}

export function replaceProperty(object: object, method: PropertyKey, value: object): () => void {
  let original = getProperty(object, method)
  let descriptor = getOwnPropertyDescriptor(object, method)
  defineProperty(object, method, {
    configurable: descriptor?.configurable ?? true,
    enumerable: descriptor?.enumerable ?? true,
    writable: descriptor && 'writable' in descriptor ? descriptor.writable : true,
    value,
  })
  return trackRestoration(value, {
    object,
    method,
    original,
    restored: false,
    restoreOriginal() {
      if (descriptor) defineProperty(object, method, descriptor)
      else if (!deleteProperty(object, method))
        throw new TypeError('Unable to restore the property')
    },
  })
}

function createMethodMock<T extends object, K extends keyof T>(
  obj: T,
  method: K,
  impl?: (...args: never[]) => unknown,
): MethodMock<Method<T, K>> {
  let original = obj[method]
  let descriptor = getOwnPropertyDescriptor(obj, method)
  let owner = obj
  let sourceDescriptor = descriptor
  while (!sourceDescriptor) {
    owner = getPrototypeOf(owner)
    if (owner === null) break
    sourceDescriptor = getOwnPropertyDescriptor(owner, method)
  }
  let getter = sourceDescriptor?.get
  let getterDescriptor = getter && getMockDescriptor(getter)
  let replacesMockedGetter =
    getterDescriptor?.slot === 'get' && getterDescriptor.restoration.kind === 'accessor'
  // Initial overrides retain the existing permissive behavior, including absent methods.
  let mockFn = createMockFn((impl ?? original) as Method<T, K>)
  if (replacesMockedGetter) {
    // The mocked getter can hide the setter's backing value. Leave that value untouched.
    defineProperty(obj, method, {
      configurable: true,
      enumerable: sourceDescriptor?.enumerable ?? true,
      writable: true,
      value: mockFn,
    })
  } else if (!setProperty(obj, method, mockFn)) {
    throw new TypeError('Unable to mock the method')
  }
  let restoration: MethodRestoration = {
    object: obj,
    method,
    original,
    restored: false,
    restoreOriginal() {
      let restoredDescriptor = descriptor
      if (descriptor || replacesMockedGetter) {
        restoredDescriptor = restoreMockDescriptor(obj, method, descriptor)
      }
      if (!replacesMockedGetter && (!restoredDescriptor || !('value' in restoredDescriptor))) {
        if (!setProperty(obj, method, original)) {
          throw new TypeError('Unable to restore the method')
        }
      }
    },
  }
  mockFn.mock.restore = trackRestoration(mockFn, restoration)
  if (!descriptor || 'value' in descriptor || replacesMockedGetter) {
    registerMockDescriptor(mockFn, 'value', {
      kind: 'method',
      object: obj,
      propertyName: method,
      // Legacy method restoration retains an own property for inherited methods.
      descriptor: replacesMockedGetter
        ? descriptor
        : (descriptor ?? {
            configurable: true,
            enumerable: true,
            writable: true,
            value: original,
          }),
      isRestored: () => restoration.restored,
    })
  }
  return mockFn
}

function createAccessorMock(
  object: object,
  methodName: PropertyKey,
  impl: ((...args: never[]) => unknown) | undefined,
  options: MockMethodOptions,
): MockFunction {
  if (object === null || (typeof object !== 'object' && typeof object !== 'function')) {
    throw new TypeError('object must be an object or function')
  }
  if (typeof methodName !== 'string' && typeof methodName !== 'symbol') {
    throw new TypeError('methodName must be a string or symbol')
  }
  if (impl !== undefined && typeof impl !== 'function') {
    throw new TypeError('implementation must be a function')
  }
  let { getter = false } = options

  let owner = object
  let ownDescriptor = getOwnPropertyDescriptor(owner, methodName)
  let descriptor = ownDescriptor
  while (!descriptor) {
    owner = getPrototypeOf(owner)
    if (owner === null) break
    descriptor = getOwnPropertyDescriptor(owner, methodName)
  }
  let original = getter ? descriptor?.get : descriptor?.set
  if (!descriptor || typeof original !== 'function') {
    throw new TypeError('methodName must identify a method or the selected accessor')
  }

  let mockFn = createMockFn(impl ?? original)
  defineProperty(object, methodName, {
    ...descriptor,
    configurable: ownDescriptor?.configurable ?? true,
    ...(getter ? { get: mockFn } : { set: mockFn }),
  })
  let restored = false
  registerMockDescriptor(mockFn, getter ? 'get' : 'set', {
    kind: 'accessor',
    object,
    propertyName: methodName,
    descriptor: ownDescriptor,
    isRestored: () => restored,
  })
  mockFn.mock.restore = () => {
    if (restored) {
      let current = getOwnPropertyDescriptor(object, methodName)
      let active = getter ? current?.get : current?.set
      // A later spy's restoration may have reinstalled this already-restored mock.
      if (active !== mockFn) return
    }
    restoreMockDescriptor(object, methodName, ownDescriptor)
    restored = true
  }
  return mockFn
}

/**
 * Creates mock functions and spies on methods, accessors, and data properties.
 * Available as {@link mock} and `t.mock`; test-context mocks restore automatically after the test.
 */
export interface MockTracker {
  /**
   * Creates a function that records every call.
   * @param impl The implementation to call (defaults to a function returning `undefined`).
   * @returns The mock function and its call context.
   */
  fn<implementation extends (...args: any[]) => any>(
    impl: implementation,
  ): MockFunction<implementation>
  fn<implementation extends (...args: any[]) => any>(
    impl?: implementation,
  ): MockFunction<implementation>

  /**
   * Records getter calls while preserving the paired setter and descriptor flags.
   * @param object The target to mock, preferably the accessor's descriptor owner.
   * @param methodName The string or symbol key to mock.
   * @param impl A replacement getter (defaults to the original).
   * @param options Selects the getter with `getter: true`.
   * @returns The mock getter function.
   */
  method<target extends object, key extends keyof target>(
    object: target,
    methodName: key,
    impl: (() => target[key]) | undefined,
    options: MockMethodOptions & { getter: true; setter?: false },
  ): MockFunction<() => target[key]>

  /**
   * Records setter calls while preserving the paired getter and descriptor flags.
   * @param object The target to mock, preferably the accessor's descriptor owner.
   * @param methodName The string or symbol key to mock.
   * @param impl A replacement setter (defaults to the original).
   * @param options Selects the setter with `setter: true`.
   * @returns The mock setter function.
   */
  method<target extends object, key extends keyof target>(
    object: target,
    methodName: key,
    impl: ((value: target[key]) => void) | undefined,
    options: MockMethodOptions & { setter: true; getter?: false },
  ): MockFunction<(value: target[key]) => void>

  /**
   * Records calls to a method while preserving its descriptor flags.
   * @param object The target to mock.
   * @param methodName The string or symbol key to mock.
   * @param impl A replacement implementation (defaults to the original).
   * @param options Keeps both accessor flags false (defaults to a data method).
   * @returns The mock method function.
   */
  method<target extends object, key extends keyof target>(
    object: target,
    methodName: key,
    impl?: MethodImplementation<target[key]>,
    options?: MockMethodOptions & { getter?: false; setter?: false },
  ): MethodMock<Method<target, key>>

  /**
   * Allows permissive initial replacements for methods, including overloaded or absent methods.
   * @param object The target to mock.
   * @param methodName The string or symbol key to mock.
   * @param impl A replacement implementation for the method.
   * @param options Keeps both accessor flags false (defaults to a data method).
   * @returns The mock method function.
   */
  method<target extends object, key extends keyof target>(
    object: target,
    methodName: key,
    impl?: (...args: never[]) => unknown,
    options?: MockMethodOptions & { getter?: false; setter?: false },
  ): MethodMock<Method<target, key>>

  /**
   * Records getter calls while preserving the paired setter.
   * @param object The target to mock, preferably the accessor's descriptor owner.
   * @param propertyName The string or symbol key to mock.
   * @param impl A replacement getter (defaults to the original).
   * @returns The mock getter function.
   */
  getter<target extends object, key extends keyof target>(
    object: target,
    propertyName: key,
    impl?: () => target[key],
  ): MockFunction<() => target[key]>

  /**
   * Records setter calls while preserving the paired getter.
   * @param object The target to mock, preferably the accessor's descriptor owner.
   * @param propertyName The string or symbol key to mock.
   * @param impl A replacement setter (defaults to the original).
   * @returns The mock setter function.
   */
  setter<target extends object, key extends keyof target>(
    object: target,
    propertyName: key,
    impl?: (value: target[key]) => void,
  ): MockFunction<(value: target[key]) => void>

  /**
   * Tracks reads and writes of an existing configurable own data property.
   * @param object A non-array object to mutate; functions are not supported.
   * @param propertyName The string or symbol key of a configurable own data property.
   * Use `getter()` or `setter()` for accessors.
   * @param values An optional replacement value. Omission retains the original value;
   * explicit `undefined` replaces it with `undefined`.
   * @returns A {@link MockProperty} proxy exposing the context through `.mock`.
   */
  property<target extends object, key extends keyof target>(
    object: target,
    propertyName: key,
    ...values: [value?: target[key]]
  ): MockProperty<target, key>
}

/**
 * A standalone {@link MockTracker} for creating mock functions and spies.
 * Use `t.mock` inside a test for automatic restoration.
 *
 * @example
 * // Standalone mock
 * const fn = mock.fn((x: number) => x * 2)
 * fn(3)
 * assert.equal(fn.mock.calls[0].result, 6)
 *
 * // Mock an existing method
 * const spy = mock.method(console, 'log')
 * console.log('hello')
 * assert.equal(spy.mock.calls.length, 1)
 * spy.mock.restore?.()
 */
export const mock: MockTracker = createMockTracker()

export function createMockTracker(
  onRestore: (restore: () => void) => void = () => {},
  onLegacyRestore: (restore: () => void) => void = onRestore,
): MockTracker {
  function fn<implementation extends (...args: any[]) => any>(
    impl: implementation,
  ): MockFunction<implementation>
  function fn<implementation extends (...args: any[]) => any>(
    impl?: implementation,
  ): MockFunction<implementation>
  function fn<implementation extends (...args: any[]) => any>(
    impl?: implementation,
  ): MockFunction<implementation> {
    let mockFn = createMockFn(impl)
    onLegacyRestore(mockFn.mock.restore)
    return mockFn
  }

  function method<target extends object, key extends keyof target>(
    object: target,
    methodName: key,
    impl: (() => target[key]) | undefined,
    options: MockMethodOptions & { getter: true; setter?: false },
  ): MockFunction<() => target[key]>
  function method<target extends object, key extends keyof target>(
    object: target,
    methodName: key,
    impl: ((value: target[key]) => void) | undefined,
    options: MockMethodOptions & { setter: true; getter?: false },
  ): MockFunction<(value: target[key]) => void>
  function method<target extends object, key extends keyof target>(
    object: target,
    methodName: key,
    impl?: MethodImplementation<target[key]>,
    options?: MockMethodOptions & { getter?: false; setter?: false },
  ): MethodMock<Method<target, key>>
  // Keep existing method replacements usable with any overload of the original method.
  function method<target extends object, key extends keyof target>(
    object: target,
    methodName: key,
    impl?: (...args: never[]) => unknown,
    options?: MockMethodOptions & { getter?: false; setter?: false },
  ): MethodMock<Method<target, key>>
  function method<target extends object, key extends keyof target>(
    object: target,
    methodName: key,
    impl?: (...args: never[]) => unknown,
    options: MockMethodOptions = {},
  ): MockFunction {
    if (options === null || typeof options !== 'object' || isArray(options)) {
      throw new TypeError('options must be an object')
    }
    let { getter = false, setter = false } = options
    if (typeof getter !== 'boolean' || typeof setter !== 'boolean') {
      throw new TypeError('getter and setter options must be booleans')
    }
    if (getter && setter) throw new TypeError('getter and setter cannot both be true')
    let fn =
      getter || setter
        ? createAccessorMock(object, methodName, impl, options)
        : createMethodMock(object, methodName, impl)
    if (getter || setter) onRestore(fn.mock.restore)
    else onLegacyRestore(fn.mock.restore)
    return fn
  }

  return {
    fn,
    method,
    getter<target extends object, key extends keyof target>(
      object: target,
      propertyName: key,
      impl?: () => target[key],
    ): MockFunction<() => target[key]> {
      return method(object, propertyName, impl, { getter: true })
    },
    setter<target extends object, key extends keyof target>(
      object: target,
      propertyName: key,
      impl?: (value: target[key]) => void,
    ): MockFunction<(value: target[key]) => void> {
      return method(object, propertyName, impl, { setter: true })
    },
    property<target extends object, key extends keyof target>(
      object: target,
      propertyName: key,
      ...values: [value?: target[key]]
    ): MockProperty<target, key> {
      let { property, restore } = createPropertyMock(object, propertyName, values)
      onRestore(restore)
      return property
    },
  }
}
