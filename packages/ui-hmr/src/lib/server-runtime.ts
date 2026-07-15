type ComponentFunction = (...args: unknown[]) => unknown

const components = new Map<string, ComponentFunction>()

export function registerComponentForHmr(
  moduleUrl: string,
  componentName: string,
  implementation: ComponentFunction,
): void {
  components.set(getComponentKey(moduleUrl, componentName), implementation)
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
