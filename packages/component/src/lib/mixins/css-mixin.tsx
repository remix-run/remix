import { createMixin } from '../mixin.ts'
import type { ElementProps } from '../jsx.ts'
import { defaultStyleManager } from '../diff-props.ts'
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
    let styleManager = resolveStyleManager(handle)
    styleManager?.remove(activeSelector)
    activeSelector = ''
  })

  return (styles, props) => {
    currentStyles = styles
    let styleTarget = resolveStyleTarget(handle)
    let { selector, css: cssText } = processStyleClass(currentStyles, styleTarget.cache)

    if (styleTarget.kind === 'manager') {
      if (activeSelector && activeSelector !== selector) {
        styleTarget.value.remove(activeSelector)
      }
      if (selector && activeSelector !== selector) {
        styleTarget.value.insert(selector, cssText)
      }
      activeSelector = selector
    }

    let nextProps = { ...props } as ElementProps & { class?: string }
    let existingClassName = joinClassNames(
      typeof props.className === 'string' ? props.className : '',
      typeof props.class === 'string' ? props.class : '',
    )
    let className = joinClassNames(existingClassName, selector)
    if (className) {
      nextProps.className = className
    } else {
      delete nextProps.className
    }
    delete nextProps.class
    return <handle.element {...nextProps} />
  }
})

function resolveStyleTarget(handle: {
  frame: { $runtime?: unknown }
}):
  | { kind: 'manager'; value: StyleManagerLike; cache: StyleCache }
  | { kind: 'cache'; value: StyleCache; cache: StyleCache } {
  let runtime = handle.frame.$runtime as
    | { styleCache?: StyleCache; styleManager?: StyleManagerLike }
    | undefined
  if (runtime?.styleCache) {
    return { kind: 'cache', value: runtime.styleCache, cache: runtime.styleCache }
  }
  let styleManager = runtime?.styleManager ?? resolveStyleManager(handle)
  if (styleManager) {
    return { kind: 'manager', value: styleManager, cache: clientStyleCache }
  }
  return { kind: 'cache', value: clientStyleCache, cache: clientStyleCache }
}

function resolveStyleManager(handle: {
  frame: { $runtime?: unknown }
}): StyleManagerLike | undefined {
  let runtime = handle.frame.$runtime as { styleManager?: StyleManagerLike } | undefined
  if (runtime?.styleManager) return runtime.styleManager
  if (typeof window === 'undefined') return undefined
  return defaultStyleManager
}

function joinClassNames(...values: string[]): string {
  let seen = new Set<string>()
  let parts: string[] = []
  for (let value of values) {
    if (!value) continue
    for (let entry of value.split(/\s+/)) {
      if (!entry || seen.has(entry)) continue
      seen.add(entry)
      parts.push(entry)
    }
  }
  return parts.join(' ')
}
