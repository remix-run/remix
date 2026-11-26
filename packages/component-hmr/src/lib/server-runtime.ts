type ComponentFunction = (...args: unknown[]) => unknown

const components = new Map<string, ComponentFunction>()
const registrations = new WeakMap<
  Function,
  { key: string; implementation: ComponentFunction; committed: boolean }
>()

export function registerComponentForHmr(
  moduleUrl: string,
  componentName: string,
  implementation: ComponentFunction,
  wrapper: Function,
): void {
  registrations.set(wrapper, {
    key: getComponentKey(moduleUrl, componentName),
    implementation,
    committed: false,
  })
}

export function commitComponentModuleForHmr(wrappers: readonly Function[]): void {
  for (let wrapper of wrappers) {
    let registration = registrations.get(wrapper)
    if (!registration || registration.committed) continue
    registration.committed = true
    components.set(registration.key, registration.implementation)
  }
}

export function getCurrentComponentForHmr(
  moduleUrl: string,
  componentName: string,
  wrapper?: Function,
): ComponentFunction {
  let registration = wrapper && registrations.get(wrapper)
  if (registration && !registration.committed) return registration.implementation
  let component = components.get(getComponentKey(moduleUrl, componentName))
  if (!component) {
    throw new Error(`[remix] Missing HMR component registration for ${moduleUrl}:${componentName}`)
  }
  return component
}

function getComponentKey(moduleUrl: string, componentName: string): string {
  return `${moduleUrl}:${componentName}`
}
