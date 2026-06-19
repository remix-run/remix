import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, type RemixNode } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'
import { onAccordionChange } from '@remix-run/ui/accordion'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  bodyStyle,
  headingStyle,
  indicatorStyle,
  itemStyle,
  panelStyle,
  rootStyle,
  AccordionTrigger,
  triggerStyle,
  type AccordionProps,
} from './components.tsx'

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
  it('renders styled accordion wrappers with ui primitive roles', () => {
    let { container } = renderApp(renderExampleAccordion({ headingLevel: 2 }))
    let headingButtons = [...container.querySelectorAll('h2 > button')] as HTMLButtonElement[]
    let panel = container.querySelector('[id$="-panel"]') as HTMLDivElement

    expect(headingButtons).toHaveLength(3)
    expect(headingButtons[0].getAttribute('data-state')).toBe('closed')
    expect(headingButtons[0].getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(headingButtons[0].id)
  })

  it('composes ui accordion events', () => {
    let values: Array<string | null | string[]> = []

    let { container, root } = renderApp(
      <div
        mix={onAccordionChange((event) => {
          values.push(event.value)
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

    expect(values).toEqual(['billing'])
  })
})

describe('accordion style exports', () => {
  it('serializes accordion mixins for the base disclosure structure', async () => {
    let html = await renderToString(
      <>
        <div mix={rootStyle}>
          <div mix={itemStyle}>
            <h3 mix={headingStyle}>
              <button aria-expanded="false" mix={triggerStyle}>
                <span>Account</span>
                <span mix={indicatorStyle}>v</span>
              </button>
            </h3>
            <div data-state="closed" mix={panelStyle}>
              <div mix={bodyStyle}>Panel</div>
            </div>
          </div>
        </div>
      </>,
    )

    expect(html).not.toContain('border-top: 1px solid #e7e7e7')
    expect(html).not.toContain('border-bottom: 1px solid #e7e7e7')
    expect(html).toContain('margin: 0')
    expect(html).toContain('min-height: 28px')
    expect(html).toContain('padding: 4px 0')
    expect(html).toContain('cursor: pointer')
    expect(html).toContain('text-decoration-line: underline')
    expect(html).toContain('padding-bottom: 12px')
    expect(html).toContain('display: flow-root')
  })
})
