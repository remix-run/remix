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
    let currentSelector = ''
    let nextSelector = ''
    let nextCss = ''
    let hostNode: null | Element = null

    host.addEventListener('afterFlush', (event) => {
      hostNode = event.node
      if (nextSelector) {
        event.node.setAttribute('data-css', nextSelector)
      } else {
        event.node.removeAttribute('data-css')
      }
      if (nextSelector === currentSelector) return
      if (currentSelector) {
        styleManager.remove(currentSelector)
      }
      if (nextSelector) {
        styleManager.insert(nextSelector, nextCss)
      }
      currentSelector = nextSelector
    })

    host.addEventListener('remove', () => {
      hostNode?.removeAttribute('data-css')
      if (!currentSelector) return
      styleManager.remove(currentSelector)
      currentSelector = ''
    })

    return (input) => {
      if (!('css' in input.props)) {
        nextSelector = ''
        nextCss = ''
        return input
      }

      let rawCss = input.props.css
      delete input.props.css
      let processed = toProcessedStyle(rawCss, styleCache)
      nextSelector = processed.selector
      nextCss = processed.css
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
