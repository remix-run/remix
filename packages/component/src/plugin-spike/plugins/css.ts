import { createStyleManager, processStyle } from '../../lib/style/index.ts'
import type { EnhancedStyleProperties } from '../../lib/style/index.ts'
import { definePlugin } from '../types.ts'

type ProcessedStyle = {
  selector: string
  css: string
}

export const css = definePlugin(() => {
  let styleCache = new Map<string, ProcessedStyle>()
  let styleManager = createStyleManager('rmx')

  return (host) => {
    let current: null | ProcessedStyle = null

    function set(node: Element, css: unknown) {
      let next = toProcessedStyle(css, styleCache)
      if (current?.selector === next.selector) return

      node.setAttribute('data-css', next.selector)
      if (current) {
        styleManager.remove(current.selector)
      }
      styleManager.insert(next.selector, next.css)
      current = next
    }

    function clear(node: Element) {
      node.removeAttribute('data-css')
      if (current) styleManager.remove(current.selector)
      current = null
    }

    host.addEventListener('remove', (event) => {
      clear(event.node)
    })

    return (input) => {
      if (!('css' in input.props)) {
        if (current) host.queueTask(clear)
        return input
      }

      let css = input.props.css
      delete input.props.css
      host.queueTask((node) => {
        set(node, css)
      })

      return input
    }
  }
})

function toProcessedStyle(value: unknown, styleCache: Map<string, ProcessedStyle>): ProcessedStyle {
  if (!isStyleObject(value)) {
    return { selector: '', css: '' }
  }
  return processStyle(value, styleCache)
}

function isStyleObject(value: unknown): value is EnhancedStyleProperties {
  if (!value) return false
  if (typeof value !== 'object') return false
  return !Array.isArray(value)
}
