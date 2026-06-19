import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createElement, createRoot, type Handle, type RemixNode } from '@remix-run/ui'

import * as accordion from './primitives.tsx'
import { AccordionChangeEvent, onAccordionChange, type AccordionProps } from './primitives.tsx'

let roots: ReturnType<typeof createRoot>[] = []

function TestAccordion(handle: Handle<AccordionProps>) {
  return () => {
    let { children, mix, ...contextProps } = handle.props
    void mix

    return (
      <accordion.Context {...contextProps}>
        <div mix={accordion.root()}>{children}</div>
      </accordion.Context>
    )
  }
}

function TestAccordionItem(handle: Handle<accordion.AccordionItemProps>) {
  return () => {
    let { children, disabled, mix, value, ...divProps } = handle.props
    void mix

    return (
      <accordion.ItemContext disabled={disabled} value={value}>
        <div {...divProps} mix={accordion.item()}>
          {children}
        </div>
      </accordion.ItemContext>
    )
  }
}

function TestAccordionTrigger(handle: Handle<accordion.AccordionTriggerProps>) {
  return () => {
    let item = handle.context.get(accordion.ItemContext)
    let headingTag = `h${item.headingLevel}` as keyof JSX.IntrinsicElements
    let { children, disabled, mix, type, ...buttonProps } = handle.props
    void mix

    let button = (
      <button {...buttonProps} mix={accordion.trigger({ disabled })} type={type ?? 'button'}>
        {children}
      </button>
    )

    return createElement(headingTag, {}, button)
  }
}

function TestAccordionContent(handle: Handle<accordion.AccordionContentProps>) {
  return () => {
    let { children, mix, ...divProps } = handle.props
    void mix

    return (
      <div {...divProps} mix={accordion.content()}>
        {children}
      </div>
    )
  }
}

function renderExampleAccordion(props: AccordionProps = {}) {
  return (
    <TestAccordion {...props}>
      <TestAccordionItem value="account">
        <TestAccordionTrigger>Account</TestAccordionTrigger>
        <TestAccordionContent>Manage your account preferences.</TestAccordionContent>
      </TestAccordionItem>
      <TestAccordionItem disabled value="security">
        <TestAccordionTrigger>Security</TestAccordionTrigger>
        <TestAccordionContent>Configure security defaults.</TestAccordionContent>
      </TestAccordionItem>
      <TestAccordionItem value="billing">
        <TestAccordionTrigger>Billing</TestAccordionTrigger>
        <TestAccordionContent>Review billing details.</TestAccordionContent>
      </TestAccordionItem>
    </TestAccordion>
  )
}

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

function activate(button: HTMLButtonElement) {
  button.click()
}

function getButtons(container: HTMLElement) {
  return [...container.querySelectorAll('button')] as HTMLButtonElement[]
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

describe('accordion', () => {
  it('supports single uncontrolled mode', () => {
    let { container, root } = renderApp(renderExampleAccordion({ defaultValue: 'account' }))
    let buttons = getButtons(container)

    expect(buttons[0].getAttribute('aria-expanded')).toBe('true')
    expect(buttons[2].getAttribute('aria-expanded')).toBe('false')

    activate(buttons[2])
    root.flush()
    buttons = getButtons(container)

    expect(buttons[0].getAttribute('aria-expanded')).toBe('false')
    expect(buttons[2].getAttribute('aria-expanded')).toBe('true')
  })

  it('lets a single item collapse by default', () => {
    let { container, root } = renderApp(
      <TestAccordion defaultValue="account">
        <TestAccordionItem value="account">
          <TestAccordionTrigger>Account</TestAccordionTrigger>
          <TestAccordionContent>Manage your account preferences.</TestAccordionContent>
        </TestAccordionItem>
      </TestAccordion>,
    )

    let button = container.querySelector('button') as HTMLButtonElement

    expect(button.getAttribute('aria-disabled')).toBe(null)

    activate(button)
    root.flush()
    button = container.querySelector('button') as HTMLButtonElement

    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('supports single controlled mode', () => {
    let changes: Array<string | null> = []

    function App(handle: Handle) {
      let value: string | null = 'account'

      return () => (
        <TestAccordion
          onValueChange={(nextValue) => {
            changes.push(nextValue)
            value = nextValue
            void handle.update()
          }}
          value={value}
        >
          <TestAccordionItem value="account">
            <TestAccordionTrigger>Account</TestAccordionTrigger>
            <TestAccordionContent>Manage your account preferences.</TestAccordionContent>
          </TestAccordionItem>
          <TestAccordionItem value="billing">
            <TestAccordionTrigger>Billing</TestAccordionTrigger>
            <TestAccordionContent>Review billing details.</TestAccordionContent>
          </TestAccordionItem>
        </TestAccordion>
      )
    }

    let { container, root } = renderApp(<App />)
    let buttons = getButtons(container)

    activate(buttons[1])
    root.flush()
    buttons = getButtons(container)

    expect(changes).toEqual(['billing'])
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false')
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps a single non-collapsible item open', () => {
    let changes: Array<string | null> = []
    let { container, root } = renderApp(
      <TestAccordion
        collapsible={false}
        defaultValue="account"
        onValueChange={(value) => {
          changes.push(value)
        }}
      >
        <TestAccordionItem value="account">
          <TestAccordionTrigger>Account</TestAccordionTrigger>
          <TestAccordionContent>Manage your account preferences.</TestAccordionContent>
        </TestAccordionItem>
      </TestAccordion>,
    )

    let button = container.querySelector('button') as HTMLButtonElement

    expect(button.getAttribute('aria-disabled')).toBe('true')

    activate(button)
    root.flush()
    button = container.querySelector('button') as HTMLButtonElement

    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(changes).toEqual([])
  })

  it('supports multiple uncontrolled mode', () => {
    let { container, root } = renderApp(
      <TestAccordion defaultValue={['account']} type="multiple">
        <TestAccordionItem value="account">
          <TestAccordionTrigger>Account</TestAccordionTrigger>
          <TestAccordionContent>Manage your account preferences.</TestAccordionContent>
        </TestAccordionItem>
        <TestAccordionItem value="billing">
          <TestAccordionTrigger>Billing</TestAccordionTrigger>
          <TestAccordionContent>Review billing details.</TestAccordionContent>
        </TestAccordionItem>
      </TestAccordion>,
    )

    let buttons = getButtons(container)

    activate(buttons[1])
    root.flush()
    buttons = getButtons(container)

    expect(buttons[0].getAttribute('aria-expanded')).toBe('true')
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')

    activate(buttons[0])
    root.flush()
    buttons = getButtons(container)

    expect(buttons[0].getAttribute('aria-expanded')).toBe('false')
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
  })

  it('supports multiple controlled mode', () => {
    let changes: string[][] = []

    function App(handle: Handle) {
      let value = ['account']

      return () => (
        <TestAccordion
          onValueChange={(nextValue) => {
            changes.push(nextValue)
            value = nextValue
            void handle.update()
          }}
          type="multiple"
          value={value}
        >
          <TestAccordionItem value="account">
            <TestAccordionTrigger>Account</TestAccordionTrigger>
            <TestAccordionContent>Manage your account preferences.</TestAccordionContent>
          </TestAccordionItem>
          <TestAccordionItem value="billing">
            <TestAccordionTrigger>Billing</TestAccordionTrigger>
            <TestAccordionContent>Review billing details.</TestAccordionContent>
          </TestAccordionItem>
        </TestAccordion>
      )
    }

    let { container, root } = renderApp(<App />)
    let buttons = getButtons(container)

    activate(buttons[1])
    root.flush()
    buttons = getButtons(container)

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
        <TestAccordion>
          <TestAccordionItem value="account">
            <TestAccordionTrigger>Account</TestAccordionTrigger>
            <TestAccordionContent>Manage your account preferences.</TestAccordionContent>
          </TestAccordionItem>
          <TestAccordionItem value="billing">
            <TestAccordionTrigger>Billing</TestAccordionTrigger>
            <TestAccordionContent>Review billing details.</TestAccordionContent>
          </TestAccordionItem>
        </TestAccordion>
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
