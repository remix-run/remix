export interface ComponentHmrState {
  [key: string]: unknown
}

export interface ComponentHmrRefresh {
  requestReconciliation(): void
  setComponentStalenessCheck(check: (component: Function) => boolean): void
}

type ComponentFunction = (...args: unknown[]) => unknown

type ComponentHmrHandle = {
  signal: AbortSignal
}

type ComponentEntry = {
  handles: Set<ComponentHmrHandle>
  implementation: ComponentFunction
  setupHash: string
}

const persistentAbortController = new AbortController()
const components = new Map<string, ComponentEntry>()
const componentKeys = new WeakMap<Function, string>()
const componentState = new WeakMap<ComponentHmrHandle, ComponentHmrState>()
const componentSetupHashes = new WeakMap<ComponentHmrHandle, Map<string, string>>()
const renderFunctions = new WeakMap<ComponentHmrHandle, ComponentFunction>()
const serverHandles = new Map<string, ComponentHmrHandle>()
const staleComponentKeys = new Set<string>()

let isStalenessCheckInstalled = false

export function registerComponentForHmr(
  refresh: ComponentHmrRefresh,
  moduleUrl: string,
  componentName: string,
  implementation: ComponentFunction,
  setupHash: string,
  wrapper: Function,
): void {
  installStalenessCheck(refresh)

  let key = getComponentKey(moduleUrl, componentName)
  let existing = components.get(key)
  if (existing && existing.setupHash !== setupHash) {
    staleComponentKeys.add(key)
  }

  components.set(key, {
    handles: existing?.handles ?? new Set(),
    implementation,
    setupHash,
  })
  componentKeys.set(wrapper, key)
}

export function getCurrentComponentForHmr(
  moduleUrl: string,
  componentName: string,
): ComponentFunction {
  let key = getComponentKey(moduleUrl, componentName)
  let component = components.get(key)
  if (!component) {
    throw new Error(`[remix] Missing HMR component registration for ${key}`)
  }
  return component.implementation
}

export function getComponentHandleForHmr(
  handle: unknown,
  moduleUrl: string,
  componentName: string,
): ComponentHmrHandle {
  if (isComponentHmrHandle(handle)) return handle

  let key = getComponentKey(moduleUrl, componentName)
  let existing = serverHandles.get(key)
  if (existing) return existing

  let serverHandle: ComponentHmrHandle = {
    signal: persistentAbortController.signal,
  }
  serverHandles.set(key, serverHandle)
  return serverHandle
}

export function getComponentHmrState(handle: ComponentHmrHandle): ComponentHmrState {
  let state = componentState.get(handle)
  if (state === undefined) {
    state = Object.create(null) as ComponentHmrState
    componentState.set(handle, state)
  }
  return state
}

export function setupComponentForHmr(
  handle: ComponentHmrHandle,
  state: ComponentHmrState,
  moduleUrl: string,
  componentName: string,
  setupHash: string,
  setup: (state: ComponentHmrState) => void,
  wrapper: Function,
): boolean {
  let key = getComponentKey(moduleUrl, componentName)
  componentKeys.set(wrapper, key)

  let setupHashes = componentSetupHashes.get(handle)
  if (!setupHashes) {
    setupHashes = new Map()
    componentSetupHashes.set(handle, setupHashes)
  }

  let currentSetupHash = setupHashes.get(key)
  if (currentSetupHash === undefined) {
    setup(state)
    setupHashes.set(key, setupHash)
    return false
  }

  if (currentSetupHash === setupHash) {
    return false
  }

  if (Object.keys(state).length === 0) {
    setup(state)
    setupHashes.set(key, setupHash)
    return false
  }

  clearComponentHmrState(handle)
  setupHashes.delete(key)
  staleComponentKeys.add(key)
  return true
}

export function clearComponentHmrState(handle: ComponentHmrHandle): void {
  componentState.delete(handle)
  renderFunctions.delete(handle)
}

export function registerComponentRenderForHmr(
  refresh: ComponentHmrRefresh,
  moduleUrl: string,
  componentName: string,
  handle: ComponentHmrHandle,
  render: ComponentFunction,
  wrapper: Function,
): void {
  let key = getComponentKey(moduleUrl, componentName)
  installStalenessCheck(refresh)
  componentKeys.set(wrapper, key)
  renderFunctions.set(handle, render)

  let component = components.get(key)
  let wasTracked = component?.handles.has(handle) === true
  if (component) {
    component.handles.add(handle)
  }

  if (wasTracked) return

  handle.signal.addEventListener(
    'abort',
    () => {
      components.get(key)?.handles.delete(handle)
      clearComponentHmrState(handle)
    },
    { once: true },
  )
}

export function callComponentRenderForHmr(handle: ComponentHmrHandle, ...args: unknown[]): unknown {
  let render = renderFunctions.get(handle)
  if (!render) {
    throw new Error('[remix] Missing HMR component render function')
  }
  return render(...args)
}

export function registerComponentInstanceForHmr(
  handle: ComponentHmrHandle,
  cleanup: () => void = () => clearComponentHmrState(handle),
): void {
  handle.signal.addEventListener('abort', cleanup, { once: true })
}

export function updateComponentModuleForHmr(
  refresh: ComponentHmrRefresh,
  moduleUrl: string,
  module: object,
): void {
  let modulePrefix = `${moduleUrl}:`
  let updated = false

  for (let key of components.keys()) {
    if (!key.startsWith(modulePrefix)) continue

    let componentName = key.slice(modulePrefix.length)
    if (componentName in module) {
      updated = true
      let component = components.get(key)
      let updatedComponent = (module as Record<string, unknown>)[componentName]
      if (typeof updatedComponent === 'function') {
        for (let handle of component?.handles ?? []) {
          updatedComponent(handle)
        }
      }
    } else {
      staleComponentKeys.add(key)
    }
  }

  if (!updated) {
    staleComponentKeys.add(modulePrefix)
  }

  refresh.requestReconciliation()

  queueMicrotask(() => {
    staleComponentKeys.clear()
  })
}

function installStalenessCheck(refresh: ComponentHmrRefresh) {
  if (isStalenessCheckInstalled) return
  isStalenessCheckInstalled = true

  refresh.setComponentStalenessCheck((component) => {
    let key = componentKeys.get(component)
    return key !== undefined && staleComponentKeys.has(key)
  })
}

function getComponentKey(moduleUrl: string, componentName: string): string {
  return `${moduleUrl}:${componentName}`
}

function isComponentHmrHandle(value: unknown): value is ComponentHmrHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'signal' in value &&
    value.signal instanceof AbortSignal
  )
}
