import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

import {
  clearSelectionIndicator,
  positionSelectionIndicator,
} from 'remix-docs-shared/ui/selection-indicator.browser'

type NavigationEvent = Event & {
  destination?: {
    url?: string
  }
}

type PendingChapterTransition = {
  fromHref: string
  toHref: string
}

let pendingTransition: PendingChapterTransition | undefined

export const ChapterNavigationIndicator = clientEntry(
  import.meta.url,
  function ChapterNavigationIndicator(handle: Handle<{ listId: string }>) {
    return () => {
      let listId = handle.props.listId
      handle.queueTask((signal) => {
        let list = document.getElementById(listId)
        if (list instanceof HTMLOListElement) {
          startChapterNavigationIndicator(list, signal)
        }
      })
      return null
    }
  },
)

export function startChapterNavigationIndicator(
  list: HTMLOListElement,
  signal: AbortSignal,
  navigation: EventTarget | undefined = window.navigation,
): void {
  let selectedLink = list.querySelector<HTMLAnchorElement>('a[aria-current="page"]') ?? undefined
  let animationFrame: number | undefined

  if (selectedLink) {
    let transition = takePendingTransition(selectedLink)
    let previousLink = transition ? findChapterLink(list, transition.fromHref) : undefined

    if (previousLink && previousLink !== selectedLink) {
      positionSelectionIndicator(list, previousLink)
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = undefined
        positionSelectionIndicator(list, selectedLink)
      })
    } else {
      positionSelectionIndicator(list, selectedLink)
    }
  }

  navigation?.addEventListener('navigate', rememberDestination, { signal })
  window.addEventListener('resize', repositionIndicator, { signal })

  void document.fonts.ready.then(() => {
    if (!signal.aborted) repositionIndicator()
  })

  signal.addEventListener('abort', () => {
    if (animationFrame !== undefined) {
      window.cancelAnimationFrame(animationFrame)
    }
    clearSelectionIndicator(list)
  })

  function rememberDestination(event: Event): void {
    let href = (event as NavigationEvent).destination?.url
    if (!href || !selectedLink) return

    let destinationLink = findChapterLink(list, href)
    if (!destinationLink || destinationLink === selectedLink) return

    pendingTransition = {
      fromHref: selectedLink.href,
      toHref: destinationLink.href,
    }
  }

  function repositionIndicator(): void {
    if (selectedLink) {
      positionSelectionIndicator(list, selectedLink)
    }
  }
}

export function findChapterLink(
  list: HTMLOListElement,
  href: string,
): HTMLAnchorElement | undefined {
  let destination = new URL(href, document.baseURI)

  return Array.from(list.querySelectorAll<HTMLAnchorElement>('a[href]')).find((link) =>
    urlsMatch(link.href, destination),
  )
}

function takePendingTransition(
  selectedLink: HTMLAnchorElement,
): PendingChapterTransition | undefined {
  let transition = pendingTransition
  pendingTransition = undefined

  return transition && urlsMatch(selectedLink.href, new URL(transition.toHref))
    ? transition
    : undefined
}

function urlsMatch(href: string, destination: URL): boolean {
  let url = new URL(href, document.baseURI)
  return (
    url.origin === destination.origin &&
    url.pathname === destination.pathname &&
    url.search === destination.search
  )
}
