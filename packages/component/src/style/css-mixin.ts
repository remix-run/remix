import { createMixin, renderMixinElement } from '../runtime/mixins/mixin.ts'
import type { MixinFactory, MixinType } from '../runtime/mixins/mixin.ts'
import type { MixinDescriptor } from '../runtime/mixins/mixin.ts'
import type { ElementProps } from '../runtime/core/vnode.ts'
import { invariant } from '../runtime/invariant.ts'
import { isMixinDescriptor } from '../runtime/core/mix.ts'
import { processStyleClass } from '../style/index.ts'
import type { CSSProps } from '../style/style.ts'

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

const cssMixinType: MixinType<Element, [styles: CSSProps], ElementProps> = (handle) => {
  let activeSelector = ''
  let activeGeneration = -1
  let currentStyles: CSSProps | undefined
  let currentStyleCache: StyleCache | undefined
  let currentEntry: StyleEntry = { selector: '', css: '' }

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
    activeGeneration = -1
  })

  return (styles, props) => {
    let runtime = handle.frame.$runtime as {
      styleCache?: StyleCache
      styleManager?: StyleManagerLike
    }
    invariant(runtime, 'css mixin requires frame runtime')
    let styleTarget = resolveStyleTarget(runtime)
    // Hoisted styles pass the same object on every render. Style objects are treated as
    // immutable, so the class generated for it on the previous render still applies.
    if (styles !== currentStyles || styleTarget.styleCache !== currentStyleCache) {
      currentEntry = processStyleClass(styles, styleTarget.styleCache)
      currentStyles = styles
      currentStyleCache = styleTarget.styleCache
    }
    let { selector, css: cssText } = currentEntry
    let styleGeneration = styleTarget.styleManager?.getGeneration?.() ?? 0

    if (styleTarget.styleManager) {
      if (activeSelector && activeSelector !== selector) {
        styleTarget.styleManager.remove(activeSelector)
      }
      if (selector && (activeSelector !== selector || activeGeneration !== styleGeneration)) {
        styleTarget.styleManager.insert(selector, cssText)
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
}

/**
 * Applies generated class names for CSS object styles.
 *
 * Style objects are treated as immutable. When an element receives the same object again, it
 * keeps the class generated on the previous render without reading the object, so pass a new
 * object to change styles instead of mutating an existing one.
 */
export const css: MixinFactory<Element, [styles: CSSProps], ElementProps> = createMixin<
  Element,
  [styles: CSSProps],
  ElementProps
>(cssMixinType)

export function isCSSMixinDescriptor(value: unknown): value is CSSMixinDescriptor {
  return isMixinDescriptor(value) && value.type === cssMixinType
}

function resolveStyleTarget(runtime: {
  styleCache?: StyleCache
  styleManager?: StyleManagerLike
}): { styleCache: StyleCache; styleManager?: StyleManagerLike } {
  return {
    styleCache: runtime.styleCache ?? clientStyleCache,
    styleManager: runtime.styleManager,
  }
}
