import type { NavigationState } from './navigation.ts'

export interface NavigationDriver {
  navigate(
    href: string,
    state: NavigationState,
    history: 'push' | 'replace' | undefined,
  ): Promise<void>
}

let activeDriver: { driver: NavigationDriver; signal: AbortSignal } | undefined

export function setNavigationDriver(signal: AbortSignal, driver: NavigationDriver): void {
  let registration = { driver, signal }
  activeDriver = registration

  signal.addEventListener(
    'abort',
    () => {
      if (activeDriver === registration) activeDriver = undefined
    },
    { once: true },
  )
}

export function getNavigationDriver(): NavigationDriver | undefined {
  if (activeDriver?.signal.aborted) activeDriver = undefined
  return activeDriver?.driver
}
