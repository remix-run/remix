import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, on, type Handle, type RemixNode } from '@remix-run/component'

import * as tooltip from './tooltip.ts'
import type { TooltipOpenChangeEvent, TooltipOpenChangeReason } from './tooltip.ts'

let roots: ReturnType<typeof createRoot>[] = []

afterEach(() => {
  for (let root of roots) root.dispose()
  roots = []
  document.body.replaceChildren()
})

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

async function settle(root: ReturnType<typeof createRoot>) {
  root.flush()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  root.flush()
}

function pointer(
  target: HTMLElement,
  type: 'pointerenter' | 'pointerleave',
  pointerType = 'mouse',
) {
  target.dispatchEvent(new PointerEvent(type, { pointerType, clientX: 0, clientY: 0 }))
}

function key(target: EventTarget, keyValue: string, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: keyValue, ...init }))
}

function press(target: EventTarget) {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
}

function isOpen(popup: HTMLElement) {
  return popup.matches(':popover-open')
}

function Tip(handle: Handle<{ label: string; props?: tooltip.TooltipContextProps }>) {
  return () => (
    <tooltip.Context {...handle.props.props}>
      <button type="button" id={`${handle.props.label}-trigger`} mix={tooltip.trigger()}>
        {handle.props.label}
      </button>
      <div id={`${handle.props.label}-popup`} mix={tooltip.popup({ placement: 'top', offset: 4 })}>
        {handle.props.label} tip
        <span mix={tooltip.arrow()} />
      </div>
    </tooltip.Context>
  )
}

function get(container: HTMLElement, label: string) {
  return {
    trigger: container.querySelector(`#${label}-trigger`) as HTMLButtonElement,
    popup: container.querySelector(`#${label}-popup`) as HTMLElement,
  }
}

describe('tooltip', () => {
  it('renders a visual-only popup that leaves the trigger name to the author', () => {
    let { container } = renderApp(<Tip label="bold" />)
    let { trigger, popup } = get(container, 'bold')

    expect(popup.getAttribute('role')).toBe(null)
    expect(popup.tabIndex).toBe(-1)
    expect(popup.getAttribute('popover')).toBe('manual')
    expect(popup.getAttribute('data-state')).toBe('closed')
    expect(trigger.getAttribute('aria-describedby')).toBe(null)
    expect(isOpen(popup)).toBe(false)
  })

  it('opens after the hover delay', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(<Tip label="bold" props={{ delay: 300 }} />)
    let { trigger, popup } = get(container, 'bold')

    pointer(trigger, 'pointerenter')
    timers.advance(299)
    await settle(root)
    expect(isOpen(popup)).toBe(false)

    timers.advance(1)
    await settle(root)
    expect(isOpen(popup)).toBe(true)
    expect(popup.getAttribute('data-state')).toBe('open')
    expect(trigger.getAttribute('aria-describedby')).toBe(null)
    expect(popup.getAttribute('data-anchor-placement')).toMatch(/^(top|bottom)/)
  })

  it('cancels a pending open when the pointer leaves first', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(<Tip label="bold" props={{ delay: 300 }} />)
    let { trigger, popup } = get(container, 'bold')

    pointer(trigger, 'pointerenter')
    timers.advance(200)
    pointer(trigger, 'pointerleave')
    timers.advance(500)
    await settle(root)

    expect(isOpen(popup)).toBe(false)
  })

  it('ignores touch hover', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(<Tip label="bold" props={{ delay: 0 }} />)
    let { trigger, popup } = get(container, 'bold')

    pointer(trigger, 'pointerenter', 'touch')
    timers.advance(1000)
    await settle(root)

    expect(isOpen(popup)).toBe(false)
  })

  it('closes after the close delay when the pointer leaves', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(<Tip label="bold" props={{ delay: 0, closeDelay: 100 }} />)
    let { trigger, popup } = get(container, 'bold')

    pointer(trigger, 'pointerenter')
    await settle(root)
    expect(isOpen(popup)).toBe(true)

    pointer(trigger, 'pointerleave')
    timers.advance(99)
    await settle(root)
    expect(isOpen(popup)).toBe(true)

    timers.advance(1)
    await settle(root)
    expect(isOpen(popup)).toBe(false)
    expect(trigger.getAttribute('aria-describedby')).toBe(null)
  })

  it('stays open while the pointer is over the popup', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(<Tip label="bold" props={{ delay: 0, closeDelay: 100 }} />)
    let { trigger, popup } = get(container, 'bold')

    pointer(trigger, 'pointerenter')
    await settle(root)
    pointer(trigger, 'pointerleave')
    pointer(popup, 'pointerenter')
    timers.advance(500)
    await settle(root)
    expect(isOpen(popup)).toBe(true)

    pointer(popup, 'pointerleave')
    timers.advance(100)
    await settle(root)
    expect(isOpen(popup)).toBe(false)
  })

  it('opens immediately on keyboard focus and closes on blur', async () => {
    let { container, root } = renderApp(<Tip label="bold" />)
    let { trigger, popup } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    expect(trigger.matches(':focus-visible')).toBe(true)
    expect(isOpen(popup)).toBe(true)

    trigger.blur()
    await settle(root)
    expect(isOpen(popup)).toBe(false)
  })

  it('closes on Escape from anywhere in the document', async () => {
    let reasons: TooltipOpenChangeReason[] = []
    let { container, root } = renderApp(
      <Tip label="bold" props={{ onOpenChange: (_open, reason) => reasons.push(reason) }} />,
    )
    let { trigger, popup } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    expect(isOpen(popup)).toBe(true)

    key(document.body, 'Escape')
    await settle(root)
    expect(isOpen(popup)).toBe(false)
    expect(document.activeElement).toBe(trigger)
    expect(reasons).toEqual(['trigger-focus', 'escape-key'])
  })

  it('consumes Escape so layers underneath stay open', async () => {
    let outerEscapes = 0
    let { container, root } = renderApp(
      <div mix={on('keydown', (event) => void (event.key === 'Escape' && outerEscapes++))}>
        <Tip label="bold" />
      </div>,
    )
    let { trigger, popup } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    key(trigger, 'Escape')
    await settle(root)
    expect(isOpen(popup)).toBe(false)
    expect(outerEscapes).toBe(0)

    key(trigger, 'Escape')
    expect(outerEscapes).toBe(1)
  })

  it('ignores Escape while an IME composition is active', async () => {
    let { container, root } = renderApp(<Tip label="bold" />)
    let { trigger, popup } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    key(document.body, 'Escape', { isComposing: true })
    await settle(root)
    expect(isOpen(popup)).toBe(true)
  })

  it('does not reopen after Escape until the pointer leaves the trigger', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(<Tip label="bold" props={{ delay: 0 }} />)
    let { trigger, popup } = get(container, 'bold')

    pointer(trigger, 'pointerenter')
    await settle(root)
    key(document.body, 'Escape')
    await settle(root)
    expect(isOpen(popup)).toBe(false)

    pointer(trigger, 'pointerenter')
    timers.advance(100)
    await settle(root)
    expect(isOpen(popup)).toBe(false)

    pointer(trigger, 'pointerleave')
    pointer(trigger, 'pointerenter')
    await settle(root)
    expect(isOpen(popup)).toBe(true)
  })

  it('closes on an outside press but not a press inside the popup', async () => {
    let reasons: TooltipOpenChangeReason[] = []
    let { container, root } = renderApp(
      <Tip label="bold" props={{ onOpenChange: (_open, reason) => reasons.push(reason) }} />,
    )
    let { trigger, popup } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    press(popup)
    await settle(root)
    expect(isOpen(popup)).toBe(true)

    press(document.body)
    await settle(root)
    expect(isOpen(popup)).toBe(false)
    expect(reasons).toEqual(['trigger-focus', 'outside-press'])
  })

  it('stays open while focus moves from the trigger into the popup', async () => {
    let { container, root } = renderApp(<Tip label="bold" />)
    let { trigger, popup } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    popup.focus()
    await settle(root)
    expect(document.activeElement).toBe(popup)
    expect(isOpen(popup)).toBe(true)

    popup.blur()
    await settle(root)
    expect(isOpen(popup)).toBe(false)
  })

  it('does not reopen when the window regains focus on the trigger', async () => {
    let { container, root } = renderApp(<Tip label="bold" />)
    let { trigger, popup } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    expect(isOpen(popup)).toBe(true)

    // Leaving the window blurs the trigger without changing the document's active element.
    trigger.dispatchEvent(new FocusEvent('blur'))
    window.dispatchEvent(new Event('blur'))
    await settle(root)
    expect(isOpen(popup)).toBe(false)

    trigger.dispatchEvent(new FocusEvent('focus'))
    await settle(root)
    expect(isOpen(popup)).toBe(false)

    trigger.blur()
    trigger.focus()
    await settle(root)
    expect(isOpen(popup)).toBe(true)
  })

  it('opens on hover after the window regains focus on the trigger', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(<Tip label="bold" props={{ delay: 0 }} />)
    let { trigger, popup } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    trigger.dispatchEvent(new FocusEvent('blur'))
    window.dispatchEvent(new Event('blur'))
    trigger.dispatchEvent(new FocusEvent('focus'))
    await settle(root)
    expect(isOpen(popup)).toBe(false)

    pointer(trigger, 'pointerenter')
    timers.advance(0)
    await settle(root)
    expect(isOpen(popup)).toBe(true)
  })

  it('stays open when the pointer returns to the trigger after aiming at the popup', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(<Tip label="bold" props={{ delay: 0 }} />)
    let { trigger, popup } = get(container, 'bold')

    pointer(trigger, 'pointerenter')
    await settle(root)
    expect(isOpen(popup)).toBe(true)

    // Leave from the trigger edge that faces the popup so an aim session starts.
    let triggerRect = trigger.getBoundingClientRect()
    let popupAbove = popup.getBoundingClientRect().bottom <= triggerRect.top
    trigger.dispatchEvent(
      new PointerEvent('pointerleave', {
        pointerType: 'mouse',
        clientX: triggerRect.left + triggerRect.width / 2,
        clientY: popupAbove ? triggerRect.top : triggerRect.bottom,
      }),
    )
    pointer(trigger, 'pointerenter')
    timers.advance(1000)
    await settle(root)
    expect(isOpen(popup)).toBe(true)
  })

  it('closes on press and does not reopen until the pointer re-enters', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(<Tip label="bold" props={{ delay: 0 }} />)
    let { trigger, popup } = get(container, 'bold')

    pointer(trigger, 'pointerenter')
    await settle(root)
    expect(isOpen(popup)).toBe(true)

    press(trigger)
    await settle(root)
    expect(isOpen(popup)).toBe(false)

    pointer(trigger, 'pointerenter')
    timers.advance(100)
    await settle(root)
    expect(isOpen(popup)).toBe(false)

    pointer(trigger, 'pointerleave')
    pointer(trigger, 'pointerenter')
    await settle(root)
    expect(isOpen(popup)).toBe(true)
  })

  it('does not suppress mouse hover after a touch press', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(<Tip label="bold" props={{ delay: 0 }} />)
    let { trigger, popup } = get(container, 'bold')

    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    pointer(trigger, 'pointerenter')
    timers.advance(0)
    await settle(root)
    expect(isOpen(popup)).toBe(true)
  })

  it('supports controlled state', async () => {
    let requests: boolean[] = []
    function Controlled(handle: Handle) {
      let open = false
      return () => (
        <>
          <Tip label="bold" props={{ open, onOpenChange: (next) => void requests.push(next) }} />
          <button
            type="button"
            id="external"
            mix={on('click', () => {
              open = !open
              void handle.update()
            })}
          />
        </>
      )
    }

    let { container, root } = renderApp(<Controlled />)
    let { trigger, popup } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    expect(requests).toEqual([true])
    expect(isOpen(popup)).toBe(false)

    let external = container.querySelector('#external') as HTMLButtonElement
    external.click()
    await settle(root)
    expect(isOpen(popup)).toBe(true)
  })

  it('does not open when disabled', async () => {
    let { container, root } = renderApp(<Tip label="bold" props={{ disabled: true }} />)
    let { trigger, popup } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    expect(isOpen(popup)).toBe(false)
  })

  it('closes with the disabled reason when disabled while open', async () => {
    let reasons: TooltipOpenChangeReason[] = []
    let disabled = false
    let update = () => {}
    function Toggleable(handle: Handle) {
      update = () => void handle.update()
      return () => (
        <Tip
          label="bold"
          props={{ disabled, onOpenChange: (_open, reason) => void reasons.push(reason) }}
        />
      )
    }

    let { container, root } = renderApp(<Toggleable />)
    let { trigger, popup } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    expect(isOpen(popup)).toBe(true)

    disabled = true
    update()
    await settle(root)
    expect(isOpen(popup)).toBe(false)
    expect(reasons).toEqual(['trigger-focus', 'disabled'])

    disabled = false
    update()
    await settle(root)
    expect(isOpen(popup)).toBe(false)
  })

  it('dispatches a bubbling open change event from the trigger', async () => {
    let events: TooltipOpenChangeEvent[] = []
    let { container, root } = renderApp(
      <div mix={tooltip.onTooltipOpenChange((event) => void events.push(event))}>
        <Tip label="bold" />
      </div>,
    )
    let { trigger } = get(container, 'bold')

    trigger.focus()
    await settle(root)
    trigger.blur()
    await settle(root)

    expect(events.map((event) => [event.open, event.reason])).toEqual([
      [true, 'trigger-focus'],
      [false, 'trigger-focus'],
    ])
  })

  it('opens neighbours instantly within a warm group and closes the previous tooltip', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(
      <tooltip.GroupContext delay={500} timeout={300}>
        <Tip label="bold" />
        <Tip label="italic" />
      </tooltip.GroupContext>,
    )
    let bold = get(container, 'bold')
    let italic = get(container, 'italic')

    pointer(bold.trigger, 'pointerenter')
    timers.advance(499)
    await settle(root)
    expect(isOpen(bold.popup)).toBe(false)
    timers.advance(1)
    await settle(root)
    expect(isOpen(bold.popup)).toBe(true)
    expect(bold.popup.hasAttribute('data-instant')).toBe(false)

    pointer(italic.trigger, 'pointerenter')
    await settle(root)
    expect(isOpen(italic.popup)).toBe(true)
    expect(italic.popup.hasAttribute('data-instant')).toBe(true)
    expect(isOpen(bold.popup)).toBe(false)

    pointer(italic.trigger, 'pointerleave')
    await settle(root)
    expect(isOpen(italic.popup)).toBe(false)

    timers.advance(100)
    pointer(bold.trigger, 'pointerenter')
    await settle(root)
    expect(isOpen(bold.popup)).toBe(true)
  })

  it('does not warm the group when a controlled owner declines to open', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(
      <tooltip.GroupContext delay={500} timeout={300}>
        <Tip label="bold" props={{ open: false }} />
        <Tip label="italic" />
      </tooltip.GroupContext>,
    )
    let bold = get(container, 'bold')
    let italic = get(container, 'italic')

    pointer(bold.trigger, 'pointerenter')
    timers.advance(500)
    await settle(root)
    pointer(bold.trigger, 'pointerleave')
    timers.advance(1000)
    await settle(root)

    pointer(italic.trigger, 'pointerenter')
    await settle(root)
    expect(isOpen(italic.popup)).toBe(false)
    timers.advance(500)
    await settle(root)
    expect(isOpen(italic.popup)).toBe(true)
  })

  it('cools down after the group timeout', async (t) => {
    let timers = t.useFakeTimers()
    let { container, root } = renderApp(
      <tooltip.GroupContext delay={500} timeout={300}>
        <Tip label="bold" />
        <Tip label="italic" />
      </tooltip.GroupContext>,
    )
    let bold = get(container, 'bold')
    let italic = get(container, 'italic')

    pointer(bold.trigger, 'pointerenter')
    timers.advance(500)
    await settle(root)
    pointer(bold.trigger, 'pointerleave')
    await settle(root)
    expect(isOpen(bold.popup)).toBe(false)

    timers.advance(300)
    pointer(italic.trigger, 'pointerenter')
    await settle(root)
    expect(isOpen(italic.popup)).toBe(false)
    timers.advance(500)
    await settle(root)
    expect(isOpen(italic.popup)).toBe(true)
  })

  it('positions the arrow toward the trigger', async () => {
    let { container, root } = renderApp(<Tip label="bold" />)
    let { trigger, popup } = get(container, 'bold')
    let arrow = popup.querySelector('[aria-hidden="true"]') as HTMLElement

    trigger.focus()
    await settle(root)

    let side = popup.getAttribute('data-anchor-placement')!.split('-')[0]
    expect(arrow.getAttribute('data-side')).toBe(side)
    expect(getComputedStyle(arrow).position).toBe('absolute')
    expect(arrow.style.left).toMatch(/px$/)
    expect(arrow.style.top).toBe('')
  })

  it('keeps the arrow padded away from the popup edges', async () => {
    let { container, root } = renderApp(
      <tooltip.Context>
        <button type="button" id="wide-trigger" mix={tooltip.trigger()} style="width: 400px">
          Wide
        </button>
        <div id="wide-popup" mix={tooltip.popup({ placement: 'top-start' })} style="width: 100px">
          Tip
          <span mix={tooltip.arrow({ padding: 8 })} style="width: 10px; height: 5px" />
        </div>
      </tooltip.Context>,
    )
    let trigger = container.querySelector('#wide-trigger') as HTMLButtonElement
    let popup = container.querySelector('#wide-popup') as HTMLElement
    let arrow = popup.querySelector('[aria-hidden="true"]') as HTMLElement

    trigger.focus()
    await settle(root)

    expect(arrow.style.left).toBe(`${popup.clientWidth - 10 - 8}px`)
    expect(arrow.hasAttribute('data-uncentered')).toBe(true)
  })
})
