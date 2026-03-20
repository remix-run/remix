export interface MockCall<Args extends unknown[] = unknown[], Result = unknown> {
  arguments: Args
  result?: Result
  error?: unknown
}

export interface MockContext<Args extends unknown[] = unknown[], Result = unknown> {
  calls: MockCall<Args, Result>[]
  restore?: () => void
}

export type MockFunction<T extends (...args: any[]) => any = (...args: any[]) => any> = T & {
  mock: MockContext<Parameters<T>, ReturnType<T>>
}

function createMockFn<T extends (...args: any[]) => any>(impl?: T): MockFunction<T> {
  let calls: MockCall<Parameters<T>, ReturnType<T>>[] = []

  let fn = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    let call: MockCall<Parameters<T>, ReturnType<T>> = { arguments: args }
    calls.push(call)
    if (impl) {
      try {
        let result = impl.apply(this, args)
        call.result = result
        return result
      } catch (error) {
        call.error = error
        throw error
      }
    }
    return undefined as ReturnType<T>
  } as MockFunction<T>

  fn.mock = { calls }
  return fn
}

function createMethodMock<T extends object, K extends keyof T>(
  obj: T,
  method: K,
  impl?: T[K] extends (...args: any[]) => any ? T[K] : never,
): MockFunction {
  let original = obj[method]
  let effectiveImpl = (impl ?? original) as (...args: any[]) => any
  let mockFn = createMockFn(effectiveImpl)
  obj[method] = mockFn as unknown as T[K]
  mockFn.mock.restore = () => {
    obj[method] = original
  }
  return mockFn
}

export const mock = {
  fn: createMockFn,
  method: createMethodMock,
}
