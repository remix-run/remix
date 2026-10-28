import { clientEntry, type Handle } from 'remix/component'

import { clearSelectionIndicator, positionSelectionIndicator } from './selection-indicator.ts'
import { getActiveHeadingIndex } from './table-of-contents-active.ts'

export const TableOfContentsBehavior = clientEntry(
  import.meta.url,
  function TableOfContentsBehavior(handle: Handle<{ listId: string }>) {
    return () => {
      let listId = handle.props.listId
      handle.queueTask((signal) => {
        let list = document.getElementById(listId)
        if (list instanceof HTMLOListElement) {
          startTableOfContentsBehavior(list, signal)
        }
      })
      return null
    }
  },
)

const settleDelay = 400

export function startTableOfContentsBehavior(list: HTMLOListElement, signal: AbortSignal) {
  let entries = Array.from(list.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')).flatMap(
    (link) => {
      let id = link.getAttribute('href')?.slice(1)
      let heading = id ? document.getElementById(id) : null
      return heading ? [{ heading, link }] : []
    },
  )
  if (entries.length === 0) return

  let initialCurrentLink = entries.find(({ link }) => link.hasAttribute('aria-current'))?.link
  let animationFrame: number | undefined
  let jumpTimer: number | undefined
  let startedAt = performance.now()

  // Only scrolling slides the indicator. Everything else (first render on a page, resizing, font
  // loading, hash changes) places it without animating.
  updateInstantly()
  list.addEventListener('click', jumpToClickedEntry, { signal })
  window.addEventListener('scroll', scheduleUpdate, { passive: true, signal })
  window.addEventListener('resize', updateInstantly, { signal })
  window.addEventListener('hashchange', updateInstantly, { signal })

  void document.fonts.ready.then(() => {
    if (!signal.aborted) updateInstantly()
  })

  signal.addEventListener('abort', () => {
    if (animationFrame !== undefined) {
      window.cancelAnimationFrame(animationFrame)
    }
    window.clearTimeout(jumpTimer)
    list.removeAttribute('data-jumping')

    for (let { link } of entries) {
      if (link === initialCurrentLink) {
        link.setAttribute('aria-current', 'location')
      } else {
        link.removeAttribute('aria-current')
      }
    }
    clearSelectionIndicator(list)
  })

  // Clicking an entry moves the indicator straight to it. Only scrolling the page slides the
  // indicator, so the scroll a click triggers can't animate it. Updates pause until that scroll
  // settles.
  function jumpToClickedEntry(event: Event) {
    let link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null
    let entry = entries.find((candidate) => candidate.link === link)
    if (!entry) return

    list.setAttribute('data-jumping', '')
    setCurrent(entry)
    endJumpSoon()
  }

  function updateInstantly() {
    if (jumpTimer !== undefined) return

    list.setAttribute('data-jumping', '')
    update()
    // Read layout so the unanimated position is committed before animation is allowed again.
    list.getBoundingClientRect()
    window.requestAnimationFrame(() => {
      if (jumpTimer === undefined) list.removeAttribute('data-jumping')
    })
  }

  function endJumpSoon() {
    window.clearTimeout(jumpTimer)
    jumpTimer = window.setTimeout(() => {
      jumpTimer = undefined
      update()
      window.requestAnimationFrame(() => list.removeAttribute('data-jumping'))
    }, 150)
  }

  function scheduleUpdate() {
    // Navigating to a page resets the scroll position just after this starts. That isn't the
    // reader scrolling, so it shouldn't slide the indicator.
    if (performance.now() - startedAt < settleDelay) {
      updateInstantly()
      return
    }
    if (jumpTimer !== undefined) {
      // Still scrolling to the clicked entry.
      endJumpSoon()
      return
    }
    if (animationFrame !== undefined) return

    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = undefined
      update()
    })
  }

  function update() {
    let activationLine = window.matchMedia('(width >= 900px)').matches ? 116 : 88
    let atDocumentEnd =
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
    let activeIndex = getActiveHeadingIndex(
      entries.map(({ heading }) => heading.getBoundingClientRect().top),
      activationLine,
      atDocumentEnd,
    )
    let activeEntry = entries[activeIndex]
    if (!activeEntry) return

    setCurrent(activeEntry)
  }

  function setCurrent(current: (typeof entries)[number]) {
    for (let entry of entries) {
      if (entry === current) {
        entry.link.setAttribute('aria-current', 'location')
      } else {
        entry.link.removeAttribute('aria-current')
      }
    }

    positionSelectionIndicator(list, current.link)
  }
}
