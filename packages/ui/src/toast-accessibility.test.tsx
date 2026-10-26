import * as assert from '@remix-run/assert'
import { on } from '@remix-run/component'
import type { Handle } from '@remix-run/component'
import { render } from '@remix-run/component/test'
import { describe, it } from '@remix-run/test'
import * as toast from './toast.tsx'
import type { ToastManager } from './toast.tsx'

function element(container: ParentNode, selector: string): HTMLElement {
  let node = container.querySelector(selector)
  assert.ok(node instanceof HTMLElement)
  return node
}

function key(target: EventTarget, value: string, shiftKey = false) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true }),
  )
}

function Notifications(handle: Handle<{ manager: ToastManager }>) {
  return () => (
    <>
      <button data-origin>Publish</button>
      <toast.Context manager={handle.props.manager}>
        {(records) => (
          <section mix={toast.root({ label: 'Benachrichtigungen' })}>
            {records.map((record) => (
              <toast.ItemContext key={record.id} toast={record}>
                <article key={record.id} data-id={record.id} mix={toast.item()}>
                  {record.title != null && <h2 mix={toast.title()}>{record.title}</h2>}
                  {record.description != null && (
                    <p mix={toast.description()}>{record.description}</p>
                  )}
                  {record.action}
                  <button mix={toast.close()}>Schliessen</button>
                </article>
              </toast.ItemContext>
            ))}
          </section>
        )}
      </toast.Context>
      <button data-after>Continue</button>
    </>
  )
}

describe('toast accessibility', () => {
  it('uses consumer-supplied names without English fallbacks', async (t) => {
    let manager = toast.createToastManager()
    manager.add({ title: 'Gespeichert', duration: 0 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let region = element(result.container, 'section')
    assert.equal(region.getAttribute('aria-label'), 'Benachrichtigungen')
    let dismiss = element(region, 'button')
    assert.equal(dismiss.textContent, 'Schliessen')
    assert.equal(dismiss.getAttribute('aria-label'), null)
    assert.equal(dismiss.getAttribute('type'), 'button')
  })

  it('names and describes rich content through the actual rendered elements', async (t) => {
    let manager = toast.createToastManager()
    manager.add({
      title: (
        <>
          Archived <strong>Notes.md</strong>
        </>
      ),
      description: (
        <>
          Use <kbd>Undo</kbd> to restore it.
        </>
      ),
      duration: 0,
    })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let item = element(result.container, 'article')
    let title = element(item, 'h2')
    let description = element(item, 'p')
    assert.equal(item.getAttribute('role'), 'dialog')
    assert.equal(item.getAttribute('aria-modal'), 'false')
    assert.equal(item.tabIndex, 0)
    assert.equal(item.getAttribute('aria-label'), null)
    assert.equal(item.getAttribute('aria-labelledby'), title.id)
    assert.equal(item.getAttribute('aria-describedby'), description.id)
    assert.equal(element(item, 'h2 strong').textContent, 'Notes.md')
    assert.equal(element(result.container, 'section').getAttribute('aria-live'), 'polite')
    assert.equal(result.container.querySelector('[role="status"]'), null)
    assert.equal(result.container.querySelector('[role="alert"]'), null)
    await result.act(() =>
      manager.update(manager.toasts[0].id, { title: 'Restored', description: undefined }),
    )
    assert.equal(element(item, 'h2').textContent, 'Restored')
    assert.equal(item.getAttribute('aria-describedby'), null)
    assert.equal(item.getAttribute('aria-labelledby'), title.id)
  })

  it('updates authored IDs and clears relationships for empty or removed parts', async (t) => {
    let manager = toast.createToastManager()
    manager.add({ id: 'note', duration: 0 })
    let currentId = 'heading-one'
    let content = 'Saved'
    let show = true
    function Example(handle: Handle) {
      return () => (
        <toast.Context manager={manager}>
          {(records) => (
            <section mix={toast.root({ label: 'Notifications' })}>
              <toast.ItemContext toast={records[0]}>
                <article mix={toast.item()}>
                  {show && (
                    <h2 id={currentId} mix={toast.title()}>
                      {content}
                    </h2>
                  )}
                  <button
                    mix={on('click', () => {
                      currentId = 'heading-two'
                      content = ''
                      void handle.update()
                    })}
                  >
                    Clear
                  </button>
                  <button
                    mix={on('click', () => {
                      content = 'Restored'
                      void handle.update()
                    })}
                  >
                    Restore
                  </button>
                  <button
                    mix={on('click', () => {
                      show = false
                      void handle.update()
                    })}
                  >
                    Remove
                  </button>
                </article>
              </toast.ItemContext>
            </section>
          )}
        </toast.Context>
      )
    }
    let result = render(<Example />)
    t.after(result.cleanup)
    let item = element(result.container, 'article')
    assert.equal(item.getAttribute('aria-labelledby'), 'heading-one')
    await result.act(() => element(item, 'button').click())
    assert.equal(item.getAttribute('aria-labelledby'), null)
    await result.act(() => element(item, 'button:nth-of-type(2)').click())
    assert.equal(item.getAttribute('aria-labelledby'), 'heading-two')
    await result.act(() => element(item, 'button:nth-of-type(3)').click())
    assert.equal(item.getAttribute('aria-labelledby'), null)
  })

  it('supports description-only notifications without fabricating a title', async (t) => {
    let manager = toast.createToastManager()
    manager.add({ description: <span>Saved</span>, duration: 0 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let item = element(result.container, 'article')
    assert.equal(item.getAttribute('aria-labelledby'), null)
    assert.equal(item.getAttribute('aria-describedby'), element(item, 'p').id)
  })

  it('announces urgent published content separately until the collection gains keyboard focus', async (t) => {
    let manager = toast.createToastManager()
    manager.add({
      id: 'urgent',
      title: (
        <>
          Connection <strong>lost</strong>
        </>
      ),
      description: 'Try again.',
      priority: 'high',
      action: <button>Retry</button>,
    })
    manager.add({ id: 'ordinary', title: 'Saved', duration: 0 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let urgent = element(result.container, '[data-id="urgent"]')
    assert.equal(urgent.getAttribute('role'), 'alertdialog')
    assert.equal(urgent.getAttribute('aria-hidden'), 'true')
    assert.equal(urgent.inert, false)
    let alert = element(result.container, '[role="alert"]')
    assert.equal(alert.textContent, 'Connection lostTry again.')
    assert.equal(alert.querySelector('button'), null)
    await result.act(() => manager.update('urgent', { description: 'Reconnecting.' }))
    assert.match(alert.textContent ?? '', /Reconnecting/)
    element(result.container, '[data-origin]').focus()
    await result.act(() => key(document, 'F6'))
    assert.equal(result.container.querySelector('[role="alert"]'), null)
    assert.equal(urgent.getAttribute('aria-hidden'), null)
    assert.equal(manager.toasts.find((record) => record.id === 'urgent')?.paused, true)
    await result.act(() => key(element(result.container, 'section'), 'F6'))
    assert.ok(result.container.querySelector('[role="alert"]'))
    assert.equal(urgent.getAttribute('aria-hidden'), 'true')
    await result.act(() => manager.update('urgent', { priority: 'low' }))
    assert.equal(result.container.querySelector('[role="alert"]'), null)
    assert.equal(urgent.getAttribute('role'), 'dialog')
    assert.equal(urgent.getAttribute('aria-hidden'), null)
  })

  it('keeps close controls out of passive announcements and exposes them during interaction', async (t) => {
    let manager = toast.createToastManager()
    manager.add({ title: 'Saved', duration: 0 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let origin = element(result.container, '[data-origin]')
    let dismiss = element(result.container, 'article button')
    assert.equal(dismiss.getAttribute('aria-hidden'), 'true')
    origin.focus()
    await result.act(() => key(document, 'F6'))
    assert.equal(dismiss.getAttribute('aria-hidden'), null)
    await result.act(() => dismiss.focus())
    await result.act(() => dismiss.click())
    assert.equal(manager.toasts.length, 0)
    assert.equal(document.activeElement, origin)
  })

  it('dismisses only the focused toast with Escape and chooses a mounted neighbour', async (t) => {
    let manager = toast.createToastManager()
    manager.add({ id: 'oldest', title: 'Oldest', duration: 0 })
    manager.add({ id: 'middle', title: 'Middle', duration: 0 })
    manager.add({ id: 'newest', title: 'Newest', duration: 0 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let origin = element(result.container, '[data-origin]')
    origin.focus()
    await result.act(() => key(document, 'F6'))
    let middle = element(result.container, '[data-id="middle"]')
    await result.act(() => middle.focus())
    await result.act(() => key(middle, 'Escape'))
    assert.deepEqual(
      manager.toasts.map((record) => record.id),
      ['newest', 'oldest'],
    )
    assert.equal(document.activeElement, element(result.container, '[data-id="oldest"]'))
    await result.act(() => key(document.activeElement ?? document, 'Escape'))
    assert.equal(document.activeElement, element(result.container, '[data-id="newest"]'))
    await result.act(() => key(document.activeElement ?? document, 'Escape'))
    assert.equal(document.activeElement, origin)
  })

  it('returns at both Tab boundaries without closing notifications', async (t) => {
    let manager = toast.createToastManager()
    manager.add({ title: 'Saved', duration: 0 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let origin = element(result.container, '[data-origin]')
    let region = element(result.container, 'section')
    origin.focus()
    await result.act(() => key(document, 'F6'))
    await result.act(() => key(region, 'Tab', true))
    assert.equal(document.activeElement, origin)
    await result.act(() => key(document, 'F6'))
    let dismiss = element(region, 'button')
    await result.act(() => dismiss.focus())
    let guards = region.querySelectorAll<HTMLElement>('[data-toast-focus-guard]')
    assert.equal(guards.length, 2)
    await result.act(() => guards[1].focus())
    assert.equal(document.activeElement, origin)
    assert.equal(manager.toasts.length, 1)
  })

  it('preserves notification order when keyboard boundary guards become active', async (t) => {
    let manager = toast.createToastManager()
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    await result.act(() => manager.add({ id: 'oldest', title: 'Oldest', duration: 0 }))
    await result.act(() => manager.add({ id: 'newest', title: 'Newest', duration: 0 }))
    let region = element(result.container, 'section')
    let origin = element(result.container, '[data-origin]')
    origin.focus()
    await result.act(() => key(document, 'F6'))
    await result.act(() => key(region, 'Tab', true))
    await result.act(() => key(document, 'F6'))
    assert.deepEqual(
      [...region.querySelectorAll('article')].map((node) => node.getAttribute('data-id')),
      ['newest', 'oldest'],
    )
    let guards = region.querySelectorAll<HTMLElement>('[data-toast-focus-guard]')
    assert.deepEqual(
      [...guards].map((node) => node.tabIndex),
      [0, -1, -1, 0],
    )
  })

  it('preserves an unsuccessful return origin and lets the browser handle the shortcut', async (t) => {
    let manager = toast.createToastManager()
    manager.add({ title: 'Saved', duration: 0 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let origin = element(result.container, '[data-origin]')
    let region = element(result.container, 'section')
    origin.focus()
    await result.act(() => key(document, 'F6'))
    origin.hidden = true
    let event = new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true })
    await result.act(() => region.dispatchEvent(event))
    assert.equal(event.defaultPrevented, false)
    assert.equal(document.activeElement, region)
    origin.hidden = false
    await result.act(() => key(region, 'F6'))
    assert.equal(document.activeElement, origin)
  })

  it('allows consumers to prevent a close activation', async (t) => {
    let manager = toast.createToastManager()
    manager.add({ title: 'Saved', duration: 0 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let dismiss = element(result.container, 'article button')
    dismiss.addEventListener('click', (event) => event.preventDefault(), { capture: true })
    await result.act(() => dismiss.click())
    assert.equal(manager.toasts.length, 1)
  })
  it('restores focus if a consumer closes the collection during shortcut entry', async (t) => {
    let manager = toast.createToastManager()
    manager.add({ title: 'Saved', duration: 0 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let origin = element(result.container, '[data-origin]')
    let region = element(result.container, 'section')
    origin.focus()
    region.addEventListener('focusin', () => manager.close(), { once: true })
    await result.act(() => key(document, 'F6'))
    assert.equal(manager.toasts.length, 0)
    assert.equal(document.activeElement, origin)
    assert.equal(region.hasAttribute('data-expanded'), false)
    await result.act(() => manager.add({ title: 'Next', duration: 10000 }))
    assert.equal(manager.toasts[0].paused, false)
  })

  it('does not revive a neighbour closed by its consumer focus handler', async (t) => {
    let manager = toast.createToastManager()
    manager.add({ id: 'old', title: 'Old', duration: 0 })
    manager.add({ id: 'new', title: 'New', duration: 0 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let origin = element(result.container, '[data-origin]')
    origin.focus()
    await result.act(() => key(document, 'F6'))
    let current = element(result.container, '[data-id="new"]')
    let neighbour = element(result.container, '[data-id="old"]')
    neighbour.addEventListener('focus', () => manager.close('old'), { once: true })
    await result.act(() => current.focus())
    await result.act(() => manager.close('new'))
    assert.equal(manager.toasts.length, 0)
    assert.equal(document.activeElement, origin)
    assert.equal(neighbour.inert, true)
  })
})
