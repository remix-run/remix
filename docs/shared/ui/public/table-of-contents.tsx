import { clientEntry, type Handle } from 'remix/ui'

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

  update()
  window.addEventListener('scroll', scheduleUpdate, { passive: true, signal })
  window.addEventListener('resize', scheduleUpdate, { signal })
  window.addEventListener('hashchange', scheduleUpdate, { signal })

  void document.fonts.ready.then(() => {
    if (!signal.aborted) scheduleUpdate()
  })

  signal.addEventListener('abort', () => {
    if (animationFrame !== undefined) {
      window.cancelAnimationFrame(animationFrame)
    }

    for (let { link } of entries) {
      if (link === initialCurrentLink) {
        link.setAttribute('aria-current', 'location')
      } else {
        link.removeAttribute('aria-current')
      }
    }
    clearSelectionIndicator(list)
  })

  function scheduleUpdate() {
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

    for (let entry of entries) {
      if (entry === activeEntry) {
        entry.link.setAttribute('aria-current', 'location')
      } else {
        entry.link.removeAttribute('aria-current')
      }
    }

    positionSelectionIndicator(list, activeEntry.link)
  }
}
