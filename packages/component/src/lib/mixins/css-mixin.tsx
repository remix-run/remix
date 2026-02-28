// @jsxRuntime classic
// @jsx jsx
import { createMixin } from '../mixin.ts'
import { jsx } from '../jsx.ts'
import type { ElementProps } from '../jsx.ts'
import { invariant } from '../invariant.ts'
import { processStyleClass } from '../style/index.ts'
import type { CSSProps } from '../style/lib/style.ts'

type StyleEntry = { selector: string; css: string }
type StyleCache = Map<string, StyleEntry>
type StyleManagerLike = {
  insert(className: string, rule: string): void
  remove(className: string): void
}

let clientStyleCache: StyleCache = new Map()

export let css = createMixin<Element, [styles: CSSProps], ElementProps>((handle) => {
  let activeSelector = ''
  let currentStyles: CSSProps = {}

  handle.addEventListener('remove', () => {
    if (!activeSelector) return
    let runtime = handle.frame.$runtime as {
      styleCache?: StyleCache
      styleManager?: StyleManagerLike
    }
    invariant(runtime, 'css mixin requires frame runtime')
    let styleTarget = resolveStyleTarget(runtime)
    styleTarget.styleManager?.remove(activeSelector)
    activeSelector = ''
  })

  return (styles, props) => {
    currentStyles = styles
    let runtime = handle.frame.$runtime as {
      styleCache?: StyleCache
      styleManager?: StyleManagerLike
    }
    invariant(runtime, 'css mixin requires frame runtime')
    let styleTarget = resolveStyleTarget(runtime)
    let { selector, css: cssText } = processStyleClass(currentStyles, styleTarget.styleCache)

    if (styleTarget.styleManager) {
      if (activeSelector && activeSelector !== selector) {
        styleTarget.styleManager.remove(activeSelector)
      }
      if (selector && activeSelector !== selector) {
        styleTarget.styleManager.insert(selector, cssText)
      }
      activeSelector = selector
    }

    if (!selector) {
      return handle.element
    }

    return (
      <handle.element
        {...props}
        className={props.className ? `${props.className} ${selector}` : selector}
      />
    )
  }
})

function resolveStyleTarget(runtime: {
  styleCache?: StyleCache
  styleManager?: StyleManagerLike
}): { styleCache: StyleCache; styleManager?: StyleManagerLike } {
  return {
    styleCache: runtime.styleCache ?? clientStyleCache,
    styleManager: runtime.styleManager,
  }
}
