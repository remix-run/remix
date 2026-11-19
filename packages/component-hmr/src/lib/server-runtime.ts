type ComponentFunction = (...args: unknown[]) => unknown

const components = new Map<string, ComponentFunction>()
const componentWrappers = new Map<string, ComponentFunction>()

export function registerComponentForHmr(
  moduleUrl: string,
  componentName: string,
  implementation: ComponentFunction,
): void {
  components.set(getComponentKey(moduleUrl, componentName), implementation)
}

export function getStableComponentForHmr<Component extends ComponentFunction>(
  moduleUrl: string,
  componentName: string,
  wrapper: Component,
): Component {
  let key = getComponentKey(moduleUrl, componentName)
  let stable = componentWrappers.get(key)
  if (stable) return stable as Component

  componentWrappers.set(key, wrapper)
  return wrapper
}

export function getCurrentComponentForHmr(
  moduleUrl: string,
  componentName: string,
): ComponentFunction {
  let component = components.get(getComponentKey(moduleUrl, componentName))
  if (!component) {
    throw new Error(`[remix] Missing HMR component registration for ${moduleUrl}:${componentName}`)
  }
  return component
}

function getComponentKey(moduleUrl: string, componentName: string): string {
  return `${moduleUrl}:${componentName}`
}
