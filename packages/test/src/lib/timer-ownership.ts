// The worker bootstrap and transformed test modules can load separate module instances.
const key = Symbol.for('remix.test.timerOwner')
const realm = globalThis as typeof globalThis & { [key]?: { owner?: object } }
const state = (realm[key] ??= {})

export function claimTimers(owner: object): void {
  if (state.owner) {
    throw timerStateError('Another mock timer controller is already enabled')
  }
  state.owner = owner
}

export function releaseTimers(owner: object): void {
  if (state.owner === owner) state.owner = undefined
}

export function timerStateError(message: string): Error {
  return Object.assign(new Error(message), { code: 'ERR_INVALID_STATE' })
}
