import { render } from '@remix-run/component/test'
import { renderToString } from '@remix-run/component/server'
import type { RemixNode } from '@remix-run/component'
import type {
  FormEntries,
  FormSchema,
  FormSubmission,
} from '@remix-run/data-schema/experimental/form'
import * as form from '../form.ts'
import type { FormContextValue } from '../form.ts'

export async function renderServerForm<entries extends FormEntries>(
  schema: FormSchema<entries>,
  children: (value: FormContextValue<entries>) => RemixNode,
  submission: FormSubmission,
) {
  let container = document.createElement('div')
  container.innerHTML = await renderToString(
    <form.Context id="form-test" schema={schema} submission={submission}>
      {children}
    </form.Context>,
  )
  document.body.appendChild(container)
  return {
    container,
    hydrate: () => renderForm(schema, children, submission, container),
  }
}

export function renderForm<entries extends FormEntries>(
  schema: FormSchema<entries>,
  children: (value: FormContextValue<entries>) => RemixNode,
  submission?: FormSubmission,
  container?: HTMLDivElement,
) {
  let current: FormContextValue<entries> | undefined
  function content(value: FormContextValue<entries>) {
    current = value
    return children(value)
  }
  let result = render(
    <form.Context id="form-test" schema={schema} submission={submission}>
      {content}
    </form.Context>,
    { container },
  )
  return {
    ...result,
    get fields() {
      if (!current) throw new Error('Form did not render')
      return current.fields
    },
    rerender(next?: FormSubmission) {
      result.root.render(
        <form.Context id="form-test" schema={schema} submission={next}>
          {content}
        </form.Context>,
      )
      result.root.flush()
    },
  }
}

export function input(container: HTMLElement, name?: string): HTMLInputElement {
  let node = name
    ? container.querySelector(`input[name="${name}"]`)
    : container.querySelector('input')
  if (!(node instanceof HTMLInputElement)) throw new Error('Missing input')
  return node
}

export function edit(
  node: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  node.value = value
  node.dispatchEvent(new Event('input', { bubbles: true }))
}

export function blur(node: HTMLElement) {
  node.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
}
