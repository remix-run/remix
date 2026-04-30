import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, type Handle, type RemixNode } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'

import {
  Accordion,
  AccordionChangeEvent,
  AccordionContent,
  AccordionItem,
  bodyStyle,
  indicatorStyle,
  itemStyle,
  onAccordionChange,
  type AccordionProps,
  panelStyle,
  rootStyle,
  AccordionTrigger,
  triggerStyle,
} from './accordion.tsx'

afterEach(() => {
  document.body.innerHTML = ''
})

function renderExampleAccordion(props: AccordionProps = {}) {
  return (
    <Accordion {...props}>
      <AccordionItem value="account">
        <AccordionTrigger>Account</AccordionTrigger>
        <AccordionContent>Manage your account preferences.</AccordionContent>
      </AccordionItem>
      <AccordionItem disabled value="security">
        <AccordionTrigger>Security</AccordionTrigger>
        <AccordionContent>Configure security defaults.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="billing">
        <AccordionTrigger>Billing</AccordionTrigger>
        <AccordionContent>Review billing details.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  return { container, root }
}

function activate(button: HTMLButtonElement) {
  button.click()
}

describe('Accordion', () => {
  it('supports single uncontrolled mode', () => {
    let { container, root } = renderApp(renderExampleAccordion({ defaultValue: 'account' }))
    let buttons = [...container.querySelectorAll('button')] as HTMLButtonElement[]

    expect(buttons[0].getAttribute('aria-expanded')).toBe('true')
    expect(buttons[2].getAttribute('aria-expanded')).toBe('false')

    activate(buttons[2])
    root.flush()

    expect(buttons[0].getAttribute('aria-expanded')).toBe('false')
    expect(buttons[2].getAttribute('aria-expanded')).toBe('true')
  })

  it('lets a single item collapse by default', () => {
    let { container, root } = renderApp(
      <Accordion defaultValue="account">
        <AccordionItem value="account">
          <AccordionTrigger>Account</AccordionTrigger>
          <AccordionContent>Manage your account preferences.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )

    let button = container.querySelector('button') as HTMLButtonElement

    expect(button.getAttribute('aria-disabled')).toBe(null)

    activate(button)
    root.flush()

    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('supports single controlled mode', () => {
    let changes: Array<string | null> = []

    function App(handle: Handle) {
      let value: string | null = 'account'

      return () => (
        <Accordion
          onValueChange={(nextValue) => {
            changes.push(nextValue)
            value = nextValue
            void handle.update()
          }}
          value={value}
        >
          <AccordionItem value="account">
            <AccordionTrigger>Account</AccordionTrigger>
            <AccordionContent>Manage your account preferences.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="billing">
            <AccordionTrigger>Billing</AccordionTrigger>
            <AccordionContent>Review billing details.</AccordionContent>
          </AccordionItem>
        </Accordion>
      )
    }

    let { container, root } = renderApp(<App />)
    let buttons = [...container.querySelectorAll('button')] as HTMLButtonElement[]

    activate(buttons[1])
    root.flush()

    expect(changes).toEqual(['billing'])
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false')
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps a single non-collapsible item open', () => {
    let changes: Array<string | null> = []
    let { container, root } = renderApp(
      <Accordion
        collapsible={false}
        defaultValue="account"
        onValueChange={(value) => {
          changes.push(value)
        }}
      >
        <AccordionItem value="account">
          <AccordionTrigger>Account</AccordionTrigger>
          <AccordionContent>Manage your account preferences.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )

    let button = container.querySelector('button') as HTMLButtonElement

    expect(button.getAttribute('aria-disabled')).toBe('true')

    activate(button)
    root.flush()

    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(changes).toEqual([])
  })

  it('supports multiple uncontrolled mode', () => {
    let { container, root } = renderApp(
      <Accordion defaultValue={['account']} type="multiple">
        <AccordionItem value="account">
          <AccordionTrigger>Account</AccordionTrigger>
          <AccordionContent>Manage your account preferences.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="billing">
          <AccordionTrigger>Billing</AccordionTrigger>
          <AccordionContent>Review billing details.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )

    let buttons = [...container.querySelectorAll('button')] as HTMLButtonElement[]

    activate(buttons[1])
    root.flush()

    expect(buttons[0].getAttribute('aria-expanded')).toBe('true')
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')

    activate(buttons[0])
    root.flush()

    expect(buttons[0].getAttribute('aria-expanded')).toBe('false')
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
  })

  it('supports multiple controlled mode', () => {
    let changes: string[][] = []

    function App(handle: Handle) {
      let value = ['account']

      return () => (
        <Accordion
          onValueChange={(nextValue) => {
            changes.push(nextValue)
            value = nextValue
            void handle.update()
          }}
          type="multiple"
          value={value}
        >
          <AccordionItem value="account">
            <AccordionTrigger>Account</AccordionTrigger>
            <AccordionContent>Manage your account preferences.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="billing">
            <AccordionTrigger>Billing</AccordionTrigger>
            <AccordionContent>Review billing details.</AccordionContent>
          </AccordionItem>
        </Accordion>
      )
    }

    let { container, root } = renderApp(<App />)
    let buttons = [...container.querySelectorAll('button')] as HTMLButtonElement[]

    activate(buttons[1])
    root.flush()

    expect(changes).toEqual([['account', 'billing']])
    expect(buttons[0].getAttribute('aria-expanded')).toBe('true')
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
  })

  it('supports disabled root and disabled items', () => {
    let { container } = renderApp(renderExampleAccordion({ disabled: true }))
    let buttons = [...container.querySelectorAll('button')] as HTMLButtonElement[]

    expect(buttons[0].disabled).toBe(true)
    expect(buttons[1].disabled).toBe(true)
    expect(buttons[2].disabled).toBe(true)
  })

  it('wires trigger and panel aria relationships and heading structure', () => {
    let { container } = renderApp(renderExampleAccordion({ headingLevel: 2 }))
    let headingButtons = [...container.querySelectorAll('h2 > button')] as HTMLButtonElement[]
    let panel = container.querySelector('[id$="-panel"]') as HTMLDivElement

    expect(headingButtons).toHaveLength(3)
    expect(headingButtons[0].getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(headingButtons[0].id)
  })

  it('supports arrow, home, and end keyboard navigation', () => {
    let { container } = renderApp(renderExampleAccordion())
    let buttons = [...container.querySelectorAll('button')] as HTMLButtonElement[]

    buttons[0].focus()
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }))
    expect(document.activeElement).toBe(buttons[2])

    buttons[2].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }))
    expect(document.activeElement).toBe(buttons[0])

    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End' }))
    expect(document.activeElement).toBe(buttons[2])

    buttons[2].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Home' }))
    expect(document.activeElement).toBe(buttons[0])
  })

  it('dispatches a bubbling Accordion change event from the root', () => {
    let captured: AccordionChangeEvent | null = null

    let { container, root } = renderApp(
      <div
        mix={onAccordionChange((event) => {
          captured = event as AccordionChangeEvent
        })}
      >
        <Accordion>
          <AccordionItem value="account">
            <AccordionTrigger>Account</AccordionTrigger>
            <AccordionContent>Manage your account preferences.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="billing">
            <AccordionTrigger>Billing</AccordionTrigger>
            <AccordionContent>Review billing details.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>,
    )

    let button = container.querySelectorAll('button')[1] as HTMLButtonElement

    activate(button)
    root.flush()

    expect(captured).toBeInstanceOf(AccordionChangeEvent)
    expect((captured as AccordionChangeEvent | null)?.accordionType).toBe('single')
    expect((captured as AccordionChangeEvent | null)?.itemValue).toBe('billing')
    expect((captured as AccordionChangeEvent | null)?.value).toBe('billing')
  })
})

describe('accordion style exports', () => {
  it('serializes accordion mixins for the base disclosure structure', async () => {
    let html = await renderToString(
      <>
        <div mix={rootStyle}>
          <div mix={itemStyle}>
            <button aria-expanded="false" mix={triggerStyle}>
              <span>Account</span>
              <span mix={indicatorStyle}>v</span>
            </button>
            <div data-state="closed" mix={panelStyle}>
              <div mix={bodyStyle}>Panel</div>
            </div>
          </div>
        </div>
      </>,
    )

    expect(html).not.toContain('border-top: 1px solid var(--rmx-color-border-subtle)')
    expect(html).not.toContain('border-bottom: 1px solid var(--rmx-color-border-subtle)')
    expect(html).toContain('padding-bottom: var(--rmx-space-md)')
    expect(html).toContain('display: flow-root')
  })
})
