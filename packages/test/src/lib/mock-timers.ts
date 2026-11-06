import { claimTimers, releaseTimers, timerStateError } from './timer-ownership.ts'
import { createTimerPromises } from './mock-timer-promises.ts'

/** APIs controlled by the clock. `scheduler.wait` requires a Node or Bun test worker. */
export type MockTimerAPI = 'Date' | 'setTimeout' | 'setInterval' | 'setImmediate' | 'scheduler.wait'

/** Options for enabling a mock clock. */
export interface MockTimersOptions {
  /** APIs to replace (defaults to all supported APIs in the current runtime). */
  apis?: readonly MockTimerAPI[]
  /** Initial epoch in milliseconds or a Date (defaults to zero). */
  now?: number | Date
}

/**
 * A Node-compatible clock for Date and timers. Only one Remix timer controller
 * may be enabled in a realm at a time. `performance.now()` remains real.
 */
export interface MockTimers {
  /**
   * Enables the clock. Calling this again before reset throws.
   * @param options APIs and initial epoch to use.
   */
  enable(options?: MockTimersOptions): void
  /**
   * Moves to the destination time, then runs due callbacks in deadline order.
   * Callbacks observe that destination, including when scheduling new timers.
   * @param milliseconds Nonnegative duration in milliseconds (defaults to 1).
   */
  tick(milliseconds?: number): void
  /**
   * Sets the epoch without running callbacks or moving pending deadlines.
   * @param milliseconds Nonnegative epoch milliseconds (defaults to zero).
   */
  setTime(milliseconds: number): void
  /**
   * Ticks once to the deadline at the bottom of the timer heap, as in Node 24.3.
   * Recurring and nested timers can remain pending. An overdue horizon throws.
   */
  runAll(): void
  /** Restores original APIs and discards pending timers. Safe when disabled. */
  reset(): void
  /** Restores original APIs, like `reset()`. */
  [Symbol.dispose](): void
}

export interface NodeTimerModules {
  timers: object
  promises: object
  scheduler: object
  createHandle(): object
}

// Share module targets with tests loaded through the TypeScript/coverage loaders.
const modulesKey = Symbol.for('remix.test.timerModules')
const realm = globalThis as typeof globalThis & { [modulesKey]?: NodeTimerModules }

export function registerNodeTimerModules(modules: NodeTimerModules): void {
  realm[modulesKey] = modules
}

export function createMockTimers(assertActive: () => void = () => {}): MockTimers {
  let activeClock: MockTimers | undefined
  let owner = {}

  function enabled(): MockTimers {
    if (!activeClock) {
      throw timerStateError('You should enable MockTimers first by calling the .enable function')
    }
    return activeClock
  }

  return {
    enable(options) {
      assertActive()
      if (activeClock) throw timerStateError('MockTimers is already enabled!')
      claimTimers(owner)
      try {
        let clock = createClock()
        // Repeated APIs must not overwrite the original descriptors during installation.
        let normalized = Array.isArray(options?.apis)
          ? { ...options, apis: [...new Set(options.apis)] }
          : options
        clock.enable(normalized)
        activeClock = clock
      } catch (error) {
        releaseTimers(owner)
        throw error
      }
    },
    tick(milliseconds) {
      enabled().tick(milliseconds)
    },
    setTime(milliseconds) {
      // Node validates this argument before checking whether the clock is enabled.
      validateTime(milliseconds === undefined ? 0 : milliseconds)
      enabled().setTime(milliseconds)
    },
    runAll() {
      enabled().runAll()
    },
    reset() {
      if (!activeClock) return
      activeClock.reset()
      activeClock = undefined
      releaseTimers(owner)
    },
    [Symbol.dispose]() {
      this.reset()
    },
  }
}

interface Timer {
  id: number
  callback: (...args: unknown[]) => void
  args: unknown[]
  deadline: number
  interval?: number
}

function createClock(): MockTimers {
  let now = 0
  let nextId = 1
  let heap: Timer[] = []
  let originals: Array<{ target: object; name: string; descriptor?: PropertyDescriptor }> = []
  let resetCleanups = new Set<() => void>()
  let handles = new WeakMap<object, number>()
  let modules = realm[modulesKey]
  let NativeDate = globalThis.Date

  function replace(target: object, name: string, value: unknown): void {
    let descriptor = Object.getOwnPropertyDescriptor(target, name)
    originals.push({ target, name, descriptor })
    Object.defineProperty(target, name, {
      configurable: descriptor?.configurable ?? true,
      enumerable: descriptor?.enumerable ?? true,
      writable: descriptor && 'writable' in descriptor ? descriptor.writable : true,
      value,
    })
  }

  function createHandle(id: number): number | object {
    if (!modules) return id
    let handle = modules.createHandle()
    handles.set(handle, id)
    return handle
  }

  function clearTimer(handle: unknown): void {
    let id =
      typeof handle === 'number'
        ? handle
        : typeof handle === 'object' && handle !== null
          ? handles.get(handle)
          : undefined
    if (id !== undefined) cancel(id)
  }

  function compare(left: Timer, right: Timer): number {
    return left.deadline - right.deadline || left.id - right.id
  }

  function up(index: number): void {
    while (index > 0) {
      let parent = (index - 1) >> 1
      if (compare(heap[parent], heap[index]) <= 0) break
      ;[heap[parent], heap[index]] = [heap[index], heap[parent]]
      index = parent
    }
  }

  function insert(timer: Timer): void {
    heap.push(timer)
    up(heap.length - 1)
  }

  function remove(index: number): void {
    let last = heap.pop()
    if (!last || index === heap.length) return
    heap[index] = last
    let parent = (index - 1) >> 1
    if (index > 0 && compare(heap[parent], last) > 0) {
      up(index)
      return
    }
    while (index * 2 + 1 < heap.length) {
      let child = index * 2 + 1
      if (child + 1 < heap.length && compare(heap[child + 1], heap[child]) < 0) child++
      if (compare(heap[index], heap[child]) <= 0) break
      ;[heap[index], heap[child]] = [heap[child], heap[index]]
      index = child
    }
  }

  function cancel(id: number): void {
    let index = heap.findIndex((timer) => timer.id === id)
    if (index !== -1) remove(index)
  }

  function schedule(
    repeat: boolean,
    callback: (...args: unknown[]) => void,
    delay = 0,
    ...args: unknown[]
  ): number {
    if (delay > 2 ** 31 - 1) delay = 1
    // Unlike Node 24.3, intervals always make progress, including at delay zero.
    if (repeat && !(delay > 0)) delay = 1
    let timer: Timer = {
      id: nextId++,
      callback,
      args,
      deadline: now + delay,
      interval: repeat ? delay : undefined,
    }
    insert(timer)
    return timer.id
  }

  return {
    enable(options) {
      let available: MockTimerAPI[] = ['setTimeout', 'setInterval', 'setImmediate', 'Date']
      available = available.filter(
        (api) =>
          typeof Reflect.get(globalThis, api) === 'function' &&
          (api === 'Date' ||
            typeof Reflect.get(globalThis, api.replace('set', 'clear')) === 'function'),
      )
      if (modules) available.push('scheduler.wait')
      let apis = options?.apis || available
      validateAPIs(apis)
      for (let api of apis) {
        if (!available.includes(api)) throw invalidValue('options.apis', api)
      }
      let initial = options?.now
      if (Number.isNaN(initial)) throw invalidValue('now', initial)
      initial ||= 0
      try {
        now = NativeDate.prototype.getTime.call(initial)
      } catch {
        validateTime(initial)
        now = initial
      }

      let promises =
        modules &&
        createTimerPromises({
          schedule(callback, delay, repeat) {
            return schedule(repeat, callback, delay)
          },
          cancel,
          onReset(cleanup) {
            resetCleanups.add(cleanup)
            return () => {
              resetCleanups.delete(cleanup)
            }
          },
        })
      try {
        for (let api of apis) {
          if (api === 'Date') {
            function MockDate(...args: unknown[]): Date | string {
              if (!new.target) return new NativeDate(now).toString()
              return Reflect.construct(NativeDate, args.length ? args : [now])
            }
            Object.defineProperties(MockDate, Object.getOwnPropertyDescriptors(NativeDate))
            Object.defineProperty(MockDate, 'now', { value: () => now })
            replace(globalThis, 'Date', MockDate)
          } else if (api === 'scheduler.wait') {
            if (modules && promises) replace(modules.scheduler, 'wait', promises.wait)
          } else {
            let set =
              api === 'setImmediate'
                ? (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
                    createHandle(schedule(false, callback, -1, ...args))
                : (callback: (...args: unknown[]) => void, delay = 0, ...args: unknown[]) =>
                    createHandle(schedule(api === 'setInterval', callback, delay, ...args))
            let clear = api.replace('set', 'clear')
            replace(globalThis, api, set)
            replace(globalThis, clear, clearTimer)
            if (modules && promises) {
              replace(modules.timers, api, set)
              replace(modules.timers, clear, clearTimer)
              replace(modules.promises, api, promises[api])
            }
          }
        }
      } catch (error) {
        this.reset()
        throw error
      }
    },
    tick(milliseconds = 1) {
      if (milliseconds < 0) throw invalidValue('time', milliseconds)
      now += milliseconds
      while (heap.length) {
        let timer = heap[0]
        if (timer.deadline > now) break
        Reflect.apply(timer.callback, undefined, timer.args)
        let index = heap.indexOf(timer)
        if (index !== -1) {
          remove(index)
          if (timer.interval !== undefined) {
            timer.deadline += timer.interval
            insert(timer)
          }
        }
      }
    },
    setTime(milliseconds = 0) {
      validateTime(milliseconds)
      now = milliseconds
    },
    runAll() {
      let bottom = heap.at(-1)
      if (bottom) this.tick(bottom.deadline - now)
    },
    reset() {
      for (let cleanup of resetCleanups) cleanup()
      resetCleanups.clear()
      for (let { target, name, descriptor } of originals.reverse()) {
        if (descriptor) Object.defineProperty(target, name, descriptor)
        else Reflect.deleteProperty(target, name)
      }
      originals = []
      handles = new WeakMap()
      heap = []
      now = 0
    },
    [Symbol.dispose]() {
      this.reset()
    },
  }
}

function invalidValue(name: string, value: unknown): TypeError {
  return Object.assign(new TypeError(`Invalid ${name}: ${String(value)}`), {
    code: 'ERR_INVALID_ARG_VALUE',
  })
}

function validateAPIs(apis: unknown): asserts apis is readonly string[] {
  if (!Array.isArray(apis) || apis.some((api) => typeof api !== 'string')) {
    throw Object.assign(new TypeError('options.apis must be an array of strings'), {
      code: 'ERR_INVALID_ARG_TYPE',
    })
  }
}

function validateTime(value: unknown): asserts value is number {
  if (typeof value !== 'number') {
    throw Object.assign(new TypeError('time must be a number'), { code: 'ERR_INVALID_ARG_TYPE' })
  }
  if (value < 0) throw invalidValue('time', value)
}
