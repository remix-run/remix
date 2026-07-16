import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

import { getActiveHeadingIndex } from './table-of-contents-active.browser.ts'

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
      link.removeAttribute('aria-current')
    }
    list.removeAttribute('data-has-current')
    list.style.removeProperty('--docs-toc-indicator-y')
    list.style.removeProperty('--docs-toc-indicator-height')
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

    let listRect = list.getBoundingClientRect()
    let linkRect = activeEntry.link.getBoundingClientRect()
    list.style.setProperty('--docs-toc-indicator-y', `${linkRect.top - listRect.top}px`)
    list.style.setProperty('--docs-toc-indicator-height', `${linkRect.height}px`)
    list.toggleAttribute('data-has-current', true)
  }
}
