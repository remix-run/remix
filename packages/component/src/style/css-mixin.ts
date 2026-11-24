import { createMixin, renderMixinElement } from '../runtime/mixins/mixin.ts'
import type { MixinFactory, MixinType } from '../runtime/mixins/mixin.ts'
import type { MixinDescriptor } from '../runtime/mixins/mixin.ts'
import type { ElementProps } from '../runtime/core/vnode.ts'
import { invariant } from '../runtime/invariant.ts'
import { processStyleClass } from './style.ts'
import type { CSSProps } from './style.ts'

type StyleEntry = { selector: string; css: string }
type StyleCache = Map<string, StyleEntry>
type StyleManagerLike = {
  insert(className: string, rule: string): void
  remove(className: string): void
  getGeneration?(): number
}

/**
 * Descriptor produced by `css(...)` for composing generated styles with other host mixins.
 */
export type CSSMixinDescriptor = MixinDescriptor<Element, [styles: CSSProps], ElementProps>

const clientStyleCache: StyleCache = new Map()

export const cssMixinType: MixinType<Element, [styles: CSSProps], ElementProps> = (handle) => {
  let activeSelector = ''
  let activeGeneration = -1

  handle.addEventListener('remove', () => {
    if (!activeSelector) return
    runtime().styleManager?.remove(activeSelector)
    activeSelector = ''
    activeGeneration = -1
  })

  return (styles, props) => {
    let { styleManager, styleCache = clientStyleCache } = runtime()
    let { selector, css: cssText } = processStyleClass(styles, styleCache)
    let styleGeneration = styleManager?.getGeneration?.() ?? 0

    if (styleManager) {
      if (activeSelector && activeSelector !== selector) {
        styleManager.remove(activeSelector)
      }
      if (selector && (activeSelector !== selector || activeGeneration !== styleGeneration)) {
        styleManager.insert(selector, cssText)
      }
      activeSelector = selector
      activeGeneration = selector ? styleGeneration : -1
    }

    if (!selector) {
      return handle.element
    }

    return renderMixinElement(handle.element, {
      ...(props ?? {}),
      className: props?.className ? `${props.className} ${selector}` : selector,
    })
  }

  function runtime() {
    let current = handle.frame.$runtime as {
      styleCache?: StyleCache
      styleManager?: StyleManagerLike
    }
    invariant(current, 'css mixin requires frame runtime')
    return current
  }
}

/**
 * Applies generated class names for CSS object styles.
 */
export const css: MixinFactory<Element, [styles: CSSProps], ElementProps> = createMixin<
  Element,
  [styles: CSSProps],
  ElementProps
>(cssMixinType)
