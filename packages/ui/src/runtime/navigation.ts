import { getNavigationDriver } from './navigation-driver.ts'

export type NavigationState = {
  target: string | undefined
  src: string
  resetScroll: boolean
  $rmx: true
}

/**
 * Options for client-side frame-aware navigation.
 */
export type NavigationOptions = {
  src?: string
  target?: string
  history?: 'push' | 'replace'
  resetScroll?: boolean
}

/**
 * Performs a client-side transition understood by the Remix frame runtime.
 *
 * @param href Destination URL.
 * @param options Navigation options.
 */
export async function navigate(href: string, options?: NavigationOptions): Promise<void> {
  let state = {
    target: options?.target,
    src: options?.src ?? href,
    resetScroll: options?.resetScroll !== false,
    $rmx: true,
  } satisfies NavigationState
  let driver = getNavigationDriver()
  if (driver) {
    await driver.navigate(href, state, options?.history)
    return
  }

  let destination = new URL(href, document.baseURI)
  if (options?.history === 'replace') window.location.replace(destination.href)
  else window.location.assign(destination.href)
}
