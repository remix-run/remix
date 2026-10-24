import type { Handle, RemixNode } from 'remix/component'
import { clientEntry, on, ref } from 'remix/component'

// One menu in the sidebar. The server renders its links; this component owns the stack and motion.
export type ApiNavPanel = {
  id: string
  content: RemixNode
}

type Side = 'before' | 'current' | 'after'

const slideDuration = 280
const slideEasing = 'cubic-bezier(0.32, 0.72, 0, 1)'
// Waiting panels move a gutter less than their width, so two sliding menus' items stay one gutter
// apart. Keep in sync with api.css.
const transforms: Record<Side, string> = {
  before: 'translateX(calc(-100% + var(--api-nav-pad-end, 0px)))',
  current: 'none',
  after: 'translateX(calc(100% - var(--api-nav-pad-start, 0px)))',
}

// The sidebar is a stack of menus, iOS-settings style: the package list, then one panel per level
// down to the current page's import path. Each panel scrolls on its own, so it keeps its place
// while hidden or sliding. Back links move up a level in place; navigating swaps in that page's
// stack, and the menus it drops slide out before they unmount.
export const ApiNav = clientEntry(
  import.meta.url,
  function ApiNav(handle: Handle<{ panels: ApiNavPanel[] }>) {
    let panels = handle.props.panels
    let currentIndex = panels.length - 1
    // Every rendered menu, in a stable order: moving a panel in the DOM would reset its scroll.
    let rendered = [...panels]
    // Menus a navigation dropped, and the side they leave by: left when going deeper or sideways,
    // right when going up.
    let exiting = new Map<string, Side>()
    let elements = new Map<string, HTMLElement>()
    let hydrated = false
    // The menu that was current at the last slide.
    let shownId: string | undefined
    // Whether keyboard focus was in the sidebar when the current menu last changed.
    let focusWasInNav = false

    handle.queueTask(() => {
      slide()
      hydrated = true
    })

    function sideOf(id: string): Side {
      let exitSide = exiting.get(id)
      if (exitSide) return exitSide
      let index = panels.findIndex((panel) => panel.id === id)
      return index < currentIndex ? 'before' : index === currentIndex ? 'current' : 'after'
    }

    function goBack(event: MouseEvent, id: string) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      if (currentIndex === 0 || id !== panels[currentIndex].id) return
      if (!(event.target instanceof Element) || !event.target.closest('[data-api-nav-back]')) return

      event.preventDefault()
      focusWasInNav = true
      currentIndex -= 1
      void handle.update()
      handle.queueTask(slide)
    }

    // Moves each panel whose side changed to its new position, from wherever it is now. The
    // computed transform includes a running slide, so an interrupted slide continues from there.
    //
    // Only the arriving and leaving menus slide. Any other menu still moving (for example the
    // package list after clicking two levels deep quickly) jumps straight to its place and hides,
    // so it can't overlap them.
    //
    // The new current menu starts attached to the one leaving, a menu-width to its side, wherever
    // that is mid-slide. Both then move with the same timing, so they stay attached.
    function slide() {
      let animate = hydrated && canSlide()
      let currentId = panels[currentIndex].id
      let leaving = shownId === currentId ? undefined : elements.get(shownId ?? '')
      let leavingX = leaving ? translateXOf(leaving) : 0
      let leavingSide = shownId ? sideOf(shownId) : 'before'
      shownId = currentId
      for (let [id, element] of elements) {
        let side = sideOf(id)
        let target = transforms[side]
        if (id !== currentId && element !== leaving) {
          for (let animation of element.getAnimations()) animation.cancel()
          element.style.transform = target
          settle(id, element)
          continue
        }
        let previous = element.style.transform
        if (previous === target) continue

        // A panel without a position yet is new; a deeper menu comes in from the right.
        let from = previous
          ? getComputedStyle(element).transform
          : side === 'current'
            ? transforms.after
            : target
        if (id === currentId && leaving) {
          from =
            leavingSide === 'before'
              ? `translateX(calc(${leavingX}px + 100% - var(--api-nav-pad-end, 0px)))`
              : `translateX(calc(${leavingX}px - 100% + var(--api-nav-pad-start, 0px)))`
        }
        for (let animation of element.getAnimations()) animation.cancel()
        element.style.transform = target

        if (!animate || from === target) {
          settle(id, element)
          continue
        }
        element.style.visibility = 'visible'
        element
          .animate([{ transform: from }, { transform: target }], {
            duration: slideDuration,
            easing: slideEasing,
          })
          .finished.then(
            () => settle(id, element),
            () => {},
          )
      }
      keepFocusInCurrentPanel()
    }

    // When a slide ends, waiting menus hide and dropped menus unmount.
    function settle(id: string, element: HTMLElement) {
      element.style.visibility = ''
      if (!exiting.delete(id)) return
      rendered = rendered.filter((panel) => panel.id !== id)
      void handle.update()
    }

    // If focus was in the sidebar, keep it in the visible menu instead of losing it with a hidden
    // one. Focus elsewhere (the page, or the body after back/forward) is left alone.
    function keepFocusInCurrentPanel() {
      let panel = elements.get(panels[currentIndex].id)
      if (!focusWasInNav || !panel || panel.contains(document.activeElement)) return
      let target =
        panel.querySelector<HTMLElement>('a[aria-current]') ?? panel.querySelector<HTMLElement>('a')
      target?.focus({ preventScroll: true })
    }

    return () => {
      if (handle.props.panels !== panels) {
        let next = handle.props.panels
        focusWasInNav = [...elements.values()].some((element) =>
          element.contains(document.activeElement),
        )
        let nextIds = new Set(next.map((panel) => panel.id))
        let previousIndex = panels.findIndex((panel) => panel.id === next[next.length - 1].id)
        let exitSide: Side =
          previousIndex !== -1 && previousIndex < currentIndex ? 'after' : 'before'
        for (let panel of panels) {
          if (!nextIds.has(panel.id)) exiting.set(panel.id, exitSide)
        }
        for (let id of nextIds) exiting.delete(id)
        // Keep surviving and exiting panels in place, take fresh content, and add new ones last.
        let byId = new Map(next.map((panel) => [panel.id, panel]))
        rendered = [
          ...rendered.map((panel) => byId.get(panel.id) ?? panel),
          ...next.filter((panel) => !rendered.some((existing) => existing.id === panel.id)),
        ].filter((panel) => byId.has(panel.id) || exiting.has(panel.id))
        panels = next
        currentIndex = next.length - 1
        handle.queueTask(slide)
      }

      return (
        <div class="api-nav">
          {rendered.map((panel) => {
            let side = sideOf(panel.id)
            let current = side === 'current' && !exiting.has(panel.id)
            return (
              <div
                key={panel.id}
                class="api-nav-panel"
                data-api-nav-panel={current ? 'current' : side}
                inert={current ? undefined : true}
                mix={[
                  ref((node, signal) => {
                    if (!(node instanceof HTMLElement)) return
                    elements.set(panel.id, node)
                    signal.addEventListener('abort', () => elements.delete(panel.id))
                  }),
                  on('click', (event) => goBack(event, panel.id)),
                ]}
              >
                {panel.content}
              </div>
            )
          })}
        </div>
      )
    }
  },
)

// The element's current horizontal offset, including a running slide.
function translateXOf(element: HTMLElement): number {
  let { transform } = getComputedStyle(element)
  return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41
}

// Only the desktop sidebar slides; the mobile menu switches instantly.
function canSlide(): boolean {
  return window.matchMedia('(width >= 900px) and (prefers-reduced-motion: no-preference)').matches
}
