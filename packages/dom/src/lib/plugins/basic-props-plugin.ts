import { definePlugin } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import type { DomElementNode } from '../dom-node-policy.ts'

export let basicPropsPlugin: Plugin<DomElementNode> = definePlugin({
  phase: 'terminal',
  priority: 0,
  setup(handle) {
    let element = handle.host.node as HTMLElement
    let previousProps: Record<string, unknown> = {}

    handle.signal.addEventListener('abort', () => {
      for (let key in previousProps) {
        removeProp(element, key)
      }
      previousProps = {}
    })

    return (context) => {
      let props = context.remainingPropsView()
      for (let key in props) {
        let nextValue = props[key]
        if (previousProps[key] === nextValue) continue
        applyProp(element, key, nextValue)
      }
      for (let key in previousProps) {
        if (key in props) continue
        removeProp(element, key)
      }
      previousProps = props
    }
  },
})

function applyProp(element: HTMLElement, key: string, value: unknown) {
  if (key === 'children') return
  if (key === 'innerHTML') {
    element.innerHTML = value == null ? '' : String(value)
    return
  }
  if (key === 'className') {
    element.className = value == null ? '' : String(value)
    return
  }
  if (key === 'class') {
    element.className = value == null ? '' : String(value)
    return
  }
  if (key === 'htmlFor') {
    applyAttribute(element, 'for', value)
    return
  }
  if (key.startsWith('data-') || key.startsWith('aria-')) {
    applyAttribute(element, key, value)
    return
  }
  if (value === false || value == null) {
    removeProp(element, key)
    return
  }
  if (key in element && !key.includes('-')) {
    ;(element as unknown as Record<string, unknown>)[key] = value
    return
  }
  applyAttribute(element, key, value)
}

function removeProp(element: HTMLElement, key: string) {
  if (key === 'children') return
  if (key === 'innerHTML') {
    element.innerHTML = ''
    return
  }
  if (key === 'className') {
    element.className = ''
    return
  }
  if (key === 'class') {
    element.className = ''
    return
  }
  if (key === 'htmlFor') {
    element.removeAttribute('for')
    return
  }
  if (key in element && !key.includes('-')) {
    let value = (element as unknown as Record<string, unknown>)[key]
    if (typeof value === 'boolean') {
      ;(element as unknown as Record<string, unknown>)[key] = false
      return
    }
    ;(element as unknown as Record<string, unknown>)[key] = ''
    return
  }
  element.removeAttribute(key)
}

function applyAttribute(element: HTMLElement, key: string, value: unknown) {
  if (value === true) {
    element.setAttribute(key, '')
    return
  }
  if (value === false || value == null) {
    element.removeAttribute(key)
    return
  }
  element.setAttribute(key, String(value))
}
