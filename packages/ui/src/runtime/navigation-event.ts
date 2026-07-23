type SourceElementNavigateEvent = NavigateEvent & {
  sourceElement?: Element | null
}

interface NavigationPrecommitControllerLike {
  redirect(url: string, options: { history: 'replace' }): void
}

interface NavigationInterceptOptionsWithPrecommit extends NavigationInterceptOptions {
  precommitHandler(controller: NavigationPrecommitControllerLike): void
}

export type NavigationReplacement =
  | {
      type: 'navigation'
      state?: unknown
    }
  | {
      type: 'form-submission'
      info: unknown
      state?: unknown
    }

export function getLinkNavigationElement(event: NavigateEvent): Element | undefined {
  let sourceElement = (event as SourceElementNavigateEvent).sourceElement
  if (!(sourceElement instanceof Element)) return

  let linkElement = sourceElement.closest('a, area')
  return linkElement instanceof Element ? linkElement : undefined
}

export function getReplaceHistory(value: string | null, defaultValue: boolean): boolean {
  if (value === 'replace') return true
  if (value === 'push') return false
  return defaultValue
}

export function interceptNavigation(
  event: NavigateEvent,
  options: {
    handler(): Promise<void>
    replacement: NavigationReplacement | undefined
  },
): void {
  let replacement = options.replacement
  if (replacement == null) {
    event.intercept({ handler: options.handler })
    return
  }

  if (
    replacement.type === 'form-submission' &&
    typeof Reflect.get(window, 'NavigationPrecommitController') === 'function'
  ) {
    let interceptOptions: NavigationInterceptOptionsWithPrecommit = {
      handler: options.handler,
      precommitHandler(controller) {
        controller.redirect(event.destination.url, { history: 'replace' })
      },
    }
    event.intercept(interceptOptions)
    return
  }

  if (event.cancelable) {
    event.preventDefault()
    window.navigation.navigate(event.destination.url, {
      history: 'replace',
      info: replacement.type === 'form-submission' ? replacement.info : undefined,
      state: replacement.state,
    })
    return
  }

  event.intercept({ handler: options.handler })
}
