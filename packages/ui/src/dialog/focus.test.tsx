import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import { activateFocusScope } from './focus.ts'

let scopes: ReturnType<typeof activateFocusScope>[] = []

function activate(
  node: HTMLElement,
  options: Parameters<typeof activateFocusScope>[1] = { modal: true },
) {
  let scope = activateFocusScope(node, options)
  scopes.push(scope)
  return scope
}

function get(selector: string) {
  let node = document.querySelector<HTMLElement>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

function tab(node: HTMLElement, shiftKey = false) {
  let event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    composed: true,
    cancelable: true,
  })
  node.dispatchEvent(event)
  return event
}

afterEach(() => {
  for (let scope of scopes.toReversed()) scope.dispose({ restoreFocus: false })
  scopes = []
  document.body.innerHTML = ''
})

describe('dialog focus scope', () => {
  it('focuses the first tabbable control, wraps at each end, and restores the opener', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="dialog" tabindex="-1"><button id="first">First</button><button id="last">Last</button></div>
    `
    get('#opener').focus()
    let scope = activate(get('#dialog'))
    expect(document.activeElement).toBe(get('#first'))
    expect(tab(get('#first'), true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(get('#last'))
    tab(get('#last'))
    expect(document.activeElement).toBe(get('#first'))
    scope.dispose()
    expect(document.activeElement).toBe(get('#opener'))
  })

  it('keeps focus on an empty dialog through forward and reverse Tab', () => {
    document.body.innerHTML = '<div id="dialog" tabindex="-1">No controls</div>'
    activate(get('#dialog'))
    expect(document.activeElement).toBe(get('#dialog'))
    expect(tab(get('#dialog')).defaultPrevented).toBe(true)
    expect(tab(get('#dialog'), true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(get('#dialog'))
  })

  it('leaves Tab between interior controls to the browser', () => {
    document.body.innerHTML =
      '<div id="dialog" tabindex="-1"><button id="first">First</button><input id="last" /></div>'
    activate(get('#dialog'))
    expect(tab(get('#first')).defaultPrevented).toBe(false)
    get('#last').focus()
    expect(tab(get('#last'), true).defaultPrevented).toBe(false)
  })

  it('scrolls wrapped keyboard focus into view in an overflowing dialog', async () => {
    document.body.innerHTML = `
      <div id="dialog" tabindex="-1" style="height: 120px; width: 200px; overflow: auto">
        <input id="first" />
        <div style="height: 600px"></div>
        <button id="last">Save</button>
      </div>
    `
    let dialog = get('#dialog')
    activate(dialog)
    expect(dialog.scrollTop).toBe(0)
    tab(get('#first'), true)
    expect(document.activeElement).toBe(get('#last'))
    // WebKit applies native focus scrolling after the first render callback.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    expect(dialog.scrollTop > 0).toBe(true)
    // WebKit can leave a fractional pixel of overshoot depending on the frame's offset.
    expect(
      get('#last').getBoundingClientRect().bottom <= dialog.getBoundingClientRect().bottom + 1,
    ).toBe(true)
    tab(get('#last'))
    expect(document.activeElement).toBe(get('#first'))
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    expect(get('#first').getBoundingClientRect().top >= dialog.getBoundingClientRect().top).toBe(
      true,
    )
  })

  it('skips disabled fieldsets, hidden controls, and unchecked radios in a selected group', () => {
    document.body.innerHTML = `
      <div id="dialog" tabindex="-1">
        <fieldset disabled><input id="disabled" /></fieldset>
        <button hidden>Hidden</button>
        <input type="radio" name="choice" />
        <input id="selected" type="radio" name="choice" checked />
        <button id="last">Last</button>
      </div>
    `
    activate(get('#dialog'))
    expect(document.activeElement).toBe(get('#selected'))
    get('#last').focus()
    tab(get('#last'))
    expect(document.activeElement).toBe(get('#selected'))
  })

  it('restores exact background attributes and keeps the backdrop and live regions available', () => {
    document.body.innerHTML = `
      <main id="background" aria-hidden="false" inert="existing"><button>Background</button></main>
      <div id="announcements"><p id="live" role="status">Saved</p><button id="other">Other</button></div>
      <div id="backdrop"></div>
      <section><div id="dialog" tabindex="-1"><button>Inside</button></div><button id="sibling">Sibling</button></section>
    `
    let scope = activate(get('#dialog'), { modal: true, getBackdrop: () => get('#backdrop') })
    expect(get('#background').getAttribute('aria-hidden')).toBe('true')
    expect(get('#sibling').inert).toBe(true)
    expect(get('#other').inert).toBe(true)
    expect(get('#live').closest('[inert]')).toBe(null)
    expect(get('#backdrop').inert).toBe(false)
    scope.dispose()
    expect(get('#background').getAttribute('inert')).toBe('existing')
    expect(get('#background').getAttribute('aria-hidden')).toBe('false')
    expect(get('#sibling').hasAttribute('inert')).toBe(false)
    expect(get('#sibling').hasAttribute('aria-hidden')).toBe(false)
  })

  it('shields background controls inserted while open', async () => {
    document.body.innerHTML = '<div id="dialog" tabindex="-1"><button>Inside</button></div>'
    let scope = activate(get('#dialog'))
    let background = document.createElement('button')
    document.body.append(background)
    await Promise.resolve()
    expect(background.inert).toBe(true)
    expect(background.getAttribute('aria-hidden')).toBe('true')
    scope.dispose()
    expect(background.inert).toBe(false)
    expect(background.hasAttribute('aria-hidden')).toBe(false)
  })

  it('resumes the parent scope after a nested scope closes', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="parent" tabindex="-1">
        <button id="child-opener">Open child</button>
        <div id="child" tabindex="-1"><button id="child-control">Child</button></div>
      </div>
    `
    get('#opener').focus()
    let parent = activate(get('#parent'))
    let child = activate(get('#child'))
    expect(document.activeElement).toBe(get('#child-control'))
    expect(get('#child-opener').inert).toBe(true)
    child.dispose()
    expect(document.activeElement).toBe(get('#child-opener'))
    expect(get('#child-opener').inert).toBe(false)
    expect(get('#opener').inert).toBe(true)
    parent.dispose()
    expect(document.activeElement).toBe(get('#opener'))
  })

  it('restores the live parent control when a confirmation opens after focus moved to body', () => {
    document.body.innerHTML = `
      <div id="parent" tabindex="-1">
        <input id="parent-control" />
        <div id="child" tabindex="-1"><button>Confirm</button></div>
      </div>
    `
    activate(get('#parent'))
    get('#parent-control').blur()
    expect(document.activeElement).toBe(document.body)
    let child = activate(get('#child'))
    get('#child').hidden = true
    child.dispose()
    expect(document.activeElement).toBe(get('#parent-control'))
  })

  it('does not fall back to a live parent when return focus is explicitly disabled', () => {
    document.body.innerHTML = `
      <div id="parent" tabindex="-1">
        <input id="parent-control" />
        <div id="child" tabindex="-1"><button>Confirm</button></div>
      </div>
    `
    activate(get('#parent'))
    let child = activate(get('#child'), { modal: true, returnFocus: false })
    get('#child').hidden = true
    let focused = document.activeElement
    child.dispose()
    expect(document.activeElement).toBe(focused)
  })

  it('does not fall back to a live parent when disposal suppresses focus restoration', () => {
    document.body.innerHTML = `
      <div id="parent" tabindex="-1">
        <input id="parent-control" />
        <div id="child" tabindex="-1"><button>Confirm</button></div>
      </div>
    `
    activate(get('#parent'))
    let child = activate(get('#child'))
    get('#child').hidden = true
    let focused = document.activeElement
    child.dispose({ restoreFocus: false })
    expect(document.activeElement).toBe(focused)
  })

  it('restores outside focus when the parent finishes closing before its child', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="parent" tabindex="-1">
        <button id="child-opener">Open child</button>
        <div id="child" tabindex="-1"><button id="inside">Inside</button></div>
      </div>
    `
    get('#opener').focus()
    let parent = activate(get('#parent'))
    let child = activate(get('#child'))
    parent.dispose()
    expect(document.activeElement).toBe(get('#inside'))
    get('#parent').hidden = true
    child.dispose()
    expect(document.activeElement).toBe(get('#opener'))
  })

  it('retains the parent return target when its subtree is removed before child cleanup', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="parent" tabindex="-1">
        <button>Open child</button>
        <div id="child" tabindex="-1"><button>Inside</button></div>
      </div>
    `
    get('#opener').focus()
    let parent = activate(get('#parent'))
    let child = activate(get('#child'))
    get('#parent').remove()
    parent.dispose()
    child.dispose()
    expect(document.activeElement).toBe(get('#opener'))
  })

  it('resolves a closing parent return target before waiting for its child cleanup', () => {
    document.body.innerHTML = `
      <button id="first">First opener</button><button id="second">Second opener</button>
      <div id="parent" tabindex="-1">
        <button>Open child</button>
        <div id="child" tabindex="-1"><button>Inside</button></div>
      </div>
    `
    let target = get('#first')
    let parent = activate(get('#parent'), { modal: true, returnFocus: () => target })
    let child = activate(get('#child'))
    parent.dispose()
    target = get('#second')
    child.dispose()
    expect(document.activeElement).toBe(get('#first'))
  })

  it('restores through multiple ancestors disposed before the innermost scope', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="parent" tabindex="-1">
        <button>Open child</button>
        <div id="child" tabindex="-1">
          <button>Open grandchild</button>
          <div id="grandchild" tabindex="-1"><button>Inside</button></div>
        </div>
      </div>
    `
    get('#opener').focus()
    let parent = activate(get('#parent'))
    let child = activate(get('#child'))
    let grandchild = activate(get('#grandchild'))
    child.dispose()
    parent.dispose()
    get('#parent').hidden = true
    grandchild.dispose()
    expect(document.activeElement).toBe(get('#opener'))
  })

  it('honors disabled restoration while resolving a disposed ancestor', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="parent" tabindex="-1">
        <button>Open child</button>
        <div id="child" tabindex="-1"><button id="inside">Inside</button></div>
      </div>
    `
    get('#opener').focus()
    let parent = activate(get('#parent'), { modal: true, returnFocus: false })
    let child = activate(get('#child'))
    parent.dispose()
    child.dispose()
    expect(document.activeElement).toBe(get('#inside'))
  })

  it('allows a newer sibling scope and does not restore an older scope over it', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="first-dialog" tabindex="-1"><button id="first-control">First</button></div>
      <div id="second-dialog" tabindex="-1"><button id="second-control">Second</button></div>
    `
    get('#opener').focus()
    let first = activate(get('#first-dialog'))
    let second = activate(get('#second-dialog'), { modal: true, returnFocus: get('#opener') })
    expect(document.activeElement).toBe(get('#second-control'))
    expect(get('#second-dialog').inert).toBe(false)
    expect(get('#first-dialog').inert).toBe(true)
    first.dispose()
    expect(document.activeElement).toBe(get('#second-control'))
    second.dispose()
    expect(document.activeElement).toBe(get('#opener'))
  })

  it('traps focus without making outside content inert in trap-focus mode', () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div id="dialog" tabindex="-1"><input id="inside" /></div>
    `
    activate(get('#dialog'), { modal: 'trap-focus' })
    expect(get('#outside').inert).toBe(false)
    expect(get('#outside').getAttribute('aria-hidden')).toBe('true')
    get('#outside').focus()
    expect(document.activeElement).toBe(get('#inside'))
  })

  it('keeps a modal parent isolated while a nonmodal child can focus parent controls', () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div id="parent" tabindex="-1">
        <button id="first">First</button>
        <div id="child" tabindex="-1"><input id="inside" /></div>
        <button id="last">Last</button>
      </div>
    `
    activate(get('#parent'))
    let outsideTarget: EventTarget | null = null
    activate(get('#child'), {
      modal: false,
      onFocusOutside(event) {
        outsideTarget = event.target
      },
    })
    expect(get('#outside').inert).toBe(true)
    expect(get('#outside').getAttribute('aria-hidden')).toBe('true')
    get('#outside').focus()
    expect(document.activeElement).toBe(get('#inside'))
    get('#last').focus()
    expect(document.activeElement).toBe(get('#last'))
    expect(outsideTarget).toBe(get('#last'))
    tab(get('#last'))
    expect(document.activeElement).toBe(get('#first'))
    tab(get('#first'), true)
    expect(document.activeElement).toBe(get('#last'))
  })

  it('keeps modal pointer isolation while a child traps focus more narrowly', async () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div id="parent" tabindex="-1">
        <button id="parent-control">Parent</button>
        <div id="child" tabindex="-1"><input id="inside" /></div>
      </div>
    `
    let parent = activate(get('#parent'))
    let child = activate(get('#child'), { modal: 'trap-focus' })
    expect(get('#outside').inert).toBe(true)
    expect(get('#parent-control').inert).toBe(false)
    expect(get('#parent-control').getAttribute('aria-hidden')).toBe('true')
    get('#parent-control').focus()
    expect(document.activeElement).toBe(get('#inside'))
    let background = document.createElement('button')
    document.body.append(background)
    await Promise.resolve()
    expect(background.inert).toBe(true)
    child.dispose()
    expect(get('#parent-control').hasAttribute('aria-hidden')).toBe(false)
    expect(get('#outside').inert).toBe(true)
    parent.dispose()
    expect(get('#outside').inert).toBe(false)
    expect(background.inert).toBe(false)
  })

  it('retains a parent focus trap when its nonmodal child is open', () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div id="parent" tabindex="-1">
        <button id="parent-control">Parent</button>
        <div id="child" tabindex="-1"><input id="inside" /></div>
      </div>
    `
    activate(get('#parent'), { modal: 'trap-focus' })
    let outsideEvents = 0
    activate(get('#child'), {
      modal: false,
      onFocusOutside() {
        outsideEvents++
      },
    })
    expect(get('#outside').inert).toBe(false)
    expect(get('#outside').getAttribute('aria-hidden')).toBe('true')
    get('#outside').focus()
    expect(document.activeElement).toBe(get('#inside'))
    expect(outsideEvents).toBe(0)
    get('#parent-control').focus()
    expect(document.activeElement).toBe(get('#parent-control'))
    expect(outsideEvents).toBe(1)
  })

  it('preserves each ancestor constraint through three mixed modes', () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div id="parent" tabindex="-1">
        <button id="parent-control">Parent</button>
        <div id="child" tabindex="-1">
          <button id="child-control">Child</button>
          <div id="grandchild" tabindex="-1"><input id="inside" /></div>
        </div>
      </div>
    `
    activate(get('#parent'))
    activate(get('#child'), { modal: 'trap-focus' })
    activate(get('#grandchild'), { modal: false })
    expect(get('#outside').inert).toBe(true)
    expect(get('#parent-control').inert).toBe(false)
    expect(get('#parent-control').getAttribute('aria-hidden')).toBe('true')
    expect(get('#child-control').hasAttribute('aria-hidden')).toBe(false)
    tab(get('#inside'))
    expect(document.activeElement).toBe(get('#child-control'))
    get('#parent-control').focus()
    expect(document.activeElement).toBe(get('#child-control'))
  })

  it('keeps a later nonmodal sibling available within the earlier modal boundary', () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div id="parent" tabindex="-1"><button id="first">First</button></div>
      <div id="child" tabindex="-1"><button id="last">Last</button></div>
    `
    activate(get('#parent'))
    activate(get('#child'), { modal: false })
    expect(get('#outside').inert).toBe(true)
    expect(get('#child').inert).toBe(false)
    expect(document.activeElement).toBe(get('#last'))
    tab(get('#last'))
    expect(document.activeElement).toBe(get('#first'))
    tab(get('#first'), true)
    expect(document.activeElement).toBe(get('#last'))
  })

  it('skips background controls between separate regions of a focus trap', () => {
    document.body.innerHTML = `
      <div id="parent" tabindex="-1"><button id="first">First</button></div>
      <button>Background between dialogs</button>
      <div id="child" tabindex="-1"><button id="last">Last</button></div>
    `
    activate(get('#parent'), { modal: 'trap-focus' })
    activate(get('#child'), { modal: false })
    get('#first').focus()
    expect(tab(get('#first')).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(get('#last'))
    expect(tab(get('#last'), true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(get('#first'))
  })

  it('keeps ancestor constraints when the active child mode becomes nonmodal', () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div id="parent" tabindex="-1">
        <button id="parent-control">Parent</button>
        <div id="child" tabindex="-1"><input /></div>
      </div>
    `
    activate(get('#parent'))
    let child = activate(get('#child'))
    child.update({ modal: false })
    expect(get('#outside').inert).toBe(true)
    expect(get('#outside').getAttribute('aria-hidden')).toBe('true')
    expect(get('#parent-control').inert).toBe(false)
    get('#parent-control').focus()
    expect(document.activeElement).toBe(get('#parent-control'))
  })

  it('recovers outside focus when an existing ancestor becomes modal', () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div id="parent" tabindex="-1">
        <button>Parent</button>
        <div id="child" tabindex="-1"><input id="inside" /></div>
      </div>
    `
    let parent = activate(get('#parent'), { modal: false })
    activate(get('#child'), { modal: false })
    get('#outside').focus()
    parent.update({ modal: true })
    expect(document.activeElement).toBe(get('#inside'))
    expect(get('#outside').inert).toBe(true)
  })

  it('updates modality in place and retains the original focus return target', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="dialog" tabindex="-1"><button id="inside">Inside</button></div>
    `
    get('#opener').focus()
    let scope = activate(get('#dialog'))
    scope.update({ modal: 'trap-focus' })
    expect(get('#opener').inert).toBe(false)
    expect(get('#opener').getAttribute('aria-hidden')).toBe('true')
    scope.update({ modal: false })
    expect(get('#opener').hasAttribute('aria-hidden')).toBe(false)
    expect(document.activeElement).toBe(get('#inside'))
    scope.dispose()
    expect(document.activeElement).toBe(get('#opener'))
  })

  it('does not promote a suspended scope when its mode changes', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="first-dialog" tabindex="-1"><button id="first-control">First</button></div>
      <div id="second-dialog" tabindex="-1"><button id="second-control">Second</button></div>
    `
    get('#opener').focus()
    let first = activate(get('#first-dialog'))
    let second = activate(get('#second-dialog'))
    first.update({ modal: false })
    expect(document.activeElement).toBe(get('#second-control'))
    expect(get('#first-dialog').inert).toBe(true)
    expect(get('#second-dialog').inert).toBe(false)
    expect(tab(get('#second-control')).defaultPrevented).toBe(true)
    second.dispose()
    expect(document.activeElement).toBe(get('#first-control'))
    expect(get('#opener').inert).toBe(false)
    first.dispose()
    expect(document.activeElement).toBe(get('#opener'))
  })

  it('does not restore focus to a remembered control moved outside the dialog', () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div id="dialog" tabindex="-1"><button id="inside">Inside</button></div>
    `
    activate(get('#dialog'), { modal: 'trap-focus' })
    document.body.append(get('#inside'))
    get('#outside').focus()
    expect(document.activeElement).toBe(get('#dialog'))
  })

  it('allows outside focus and reports it for a nonmodal scope', () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div id="dialog" tabindex="-1"><button id="inside">Inside</button></div>
    `
    let outsideTarget: EventTarget | null = null
    activate(get('#dialog'), {
      modal: false,
      onFocusOutside(event) {
        outsideTarget = event.target
      },
    })
    get('#outside').focus()
    expect(document.activeElement).toBe(get('#outside'))
    expect(outsideTarget).toBe(get('#outside'))
    expect(get('#outside').hasAttribute('aria-hidden')).toBe(false)
    expect(get('#outside').inert).toBe(false)
  })

  it('preserves intentional outside focus when restoration is disabled on disposal', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button><button id="outside">Outside</button>
      <div id="dialog" tabindex="-1"><button>Inside</button></div>
    `
    get('#opener').focus()
    let scope = activate(get('#dialog'), { modal: false })
    get('#outside').focus()
    scope.dispose({ restoreFocus: false })
    expect(document.activeElement).toBe(get('#outside'))
  })

  it('supports explicit initial and return targets', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button><button id="return">Return</button>
      <div id="dialog" tabindex="-1"><button>First</button><h2 id="heading" tabindex="-1">Heading</h2></div>
    `
    get('#opener').focus()
    let scope = activate(get('#dialog'), {
      modal: true,
      initialFocus: get('#heading'),
      returnFocus: get('#return'),
    })
    expect(document.activeElement).toBe(get('#heading'))
    scope.dispose()
    expect(document.activeElement).toBe(get('#return'))
  })

  it('resolves a return target when the scope closes', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="dialog" tabindex="-1"><button>Inside</button></div>
    `
    get('#opener').focus()
    let returnTarget: HTMLElement | null = null
    let scope = activate(get('#dialog'), { modal: true, returnFocus: () => returnTarget })
    returnTarget = document.createElement('button')
    document.body.append(returnTarget)
    scope.dispose()
    expect(document.activeElement).toBe(returnTarget)
  })

  it('uses the opener when a lazy return target is absent', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="dialog" tabindex="-1"><button>Inside</button></div>
    `
    get('#opener').focus()
    let scope = activate(get('#dialog'), { modal: true, returnFocus: () => null })
    scope.dispose()
    expect(document.activeElement).toBe(get('#opener'))
  })

  it('supports disabling autofocus and focus restoration', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="dialog" tabindex="-1"><button id="inside">Inside</button></div>
    `
    get('#opener').focus()
    let scope = activate(get('#dialog'), { modal: false, initialFocus: false, returnFocus: false })
    expect(document.activeElement).toBe(get('#opener'))
    get('#inside').focus()
    scope.dispose()
    expect(document.activeElement).toBe(get('#inside'))
  })

  it('focuses the dialog when its focused control is removed', async () => {
    document.body.innerHTML =
      '<div id="dialog" tabindex="-1"><button id="inside">Inside</button></div>'
    activate(get('#dialog'))
    get('#inside').remove()
    await Promise.resolve()
    expect(document.activeElement).toBe(get('#dialog'))
  })

  it('leaves outside focus alone when a previously focused nonmodal control is removed', async () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div id="dialog" tabindex="-1"><button id="inside">Inside</button></div>
    `
    activate(get('#dialog'), { modal: false })
    get('#outside').focus()
    get('#inside').remove()
    await Promise.resolve()
    expect(document.activeElement).toBe(get('#outside'))
  })

  it('includes shadow-root controls in autofocus and focus wrapping', () => {
    document.body.innerHTML =
      '<div id="dialog" tabindex="-1"><div id="host"></div><button id="last">Last</button></div>'
    let shadow = get('#host').attachShadow({ mode: 'open' })
    let control = document.createElement('button')
    control.textContent = 'Shadow control'
    shadow.append(control)
    activate(get('#dialog'))
    expect(shadow.activeElement).toBe(control)
    tab(control, true)
    expect(document.activeElement).toBe(get('#last'))
    tab(get('#last'))
    expect(shadow.activeElement).toBe(control)
  })

  it('recovers focus when the focused control is removed from a shadow root', async () => {
    document.body.innerHTML = '<div id="dialog" tabindex="-1"><div id="host"></div></div>'
    let shadow = get('#host').attachShadow({ mode: 'open' })
    let control = document.createElement('button')
    shadow.append(control)
    activate(get('#dialog'))
    control.remove()
    await Promise.resolve()
    expect(document.activeElement).toBe(get('#dialog'))
  })

  it('keeps a dialog inside a shadow root available while shielding its siblings', () => {
    document.body.innerHTML = '<button id="outside">Outside</button><div id="host"></div>'
    let shadow = get('#host').attachShadow({ mode: 'open' })
    let surface = document.createElement('div')
    surface.tabIndex = -1
    let control = document.createElement('button')
    surface.append(control)
    let sibling = document.createElement('button')
    shadow.append(surface, sibling)
    activate(surface)
    expect(shadow.activeElement).toBe(control)
    expect(get('#host').inert).toBe(false)
    expect(sibling.inert).toBe(true)
    expect(get('#outside').inert).toBe(true)
  })

  it('allows focus in a nested native popover', () => {
    document.body.innerHTML = `
      <div id="dialog" tabindex="-1"><button>First</button><div id="popover" popover="manual"><input id="input" /></div></div>
    `
    activate(get('#dialog'))
    get('#popover').showPopover()
    get('#input').focus()
    expect(document.activeElement).toBe(get('#input'))
    get('#popover').hidePopover()
  })
})
