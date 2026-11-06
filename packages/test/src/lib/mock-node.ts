import timers from 'node:timers'
import promises from 'node:timers/promises'
import { registerNodeTimerModules } from './mock-timers.ts'

export function installNodeTimerModules(): void {
  registerNodeTimerModules({
    timers,
    promises,
    scheduler: promises.scheduler,
    createHandle() {
      return new MockTimerHandle()
    },
  })
}

// These methods match Node 24.3's mock handles; fake timers do not keep the process alive.
class MockTimerHandle {
  hasRef(): boolean {
    return true
  }

  ref(): this {
    return this
  }

  unref(): this {
    return this
  }

  refresh(): this {
    return this
  }
}
