import type { MixinDescriptor } from '@remix-run/reconciler'

type CssScalar = string | number
export type CssInput = {
  [key: string]: CssScalar | CssInput | null | undefined
}

let CSS_MIXIN_DESCRIPTOR_SYMBOL = Symbol.for('rmx.dom.css-mixin-descriptor')
export let CSS_MIXIN_STYLE_TAG_ATTR = 'data-rmx-css-mixin'
export let CSS_MIXIN_STYLE_TAG_ORIGIN_ATTR = 'data-rmx-css-origin'

type CssMixinDescriptor = MixinDescriptor<Element, [styles: CssInput | null | undefined], string> & {
  [CSS_MIXIN_DESCRIPTOR_SYMBOL]?: true
}

export function markCssMixinDescriptor(
  descriptor: MixinDescriptor<Element, [styles: CssInput | null | undefined], string>,
) {
  ;(descriptor as CssMixinDescriptor)[CSS_MIXIN_DESCRIPTOR_SYMBOL] = true
  return descriptor
}

export function isCssMixinDescriptor(
  value: unknown,
): value is MixinDescriptor<Element, [styles: CssInput | null | undefined], string> {
  if (!value || typeof value !== 'object') return false
  return (value as CssMixinDescriptor)[CSS_MIXIN_DESCRIPTOR_SYMBOL] === true
}

export function isCssInput(value: unknown): value is CssInput {
  if (!value || typeof value !== 'object') return false
  return !Array.isArray(value)
}

export function createCssKey(styles: CssInput) {
  return stableSerialize(styles)
}

export function createCssClassName(key: string) {
  return `rmx-css-${hashString(key)}`
}

export function appendClassName(existing: unknown, nextClassName: string) {
  if (typeof existing !== 'string' || existing.length === 0) return nextClassName
  let classNames = existing.split(/\s+/).filter(Boolean)
  if (classNames.includes(nextClassName)) return existing
  return `${existing} ${nextClassName}`
}

export function compileCss(selector: string, styles: CssInput): string {
  let declarations = ''
  let nestedBlocks = ''
  for (let key in styles) {
    let value = styles[key]
    if (value == null) continue
    if (isCssInput(value)) {
      if (key.startsWith('@')) {
        let nestedCss = compileCss(selector, value)
        if (nestedCss) nestedBlocks += `${key}{${nestedCss}}`
        continue
      }
      let nestedSelector = toNestedSelector(selector, key)
      nestedBlocks += compileCss(nestedSelector, value)
      continue
    }
    declarations += `${toCssPropertyName(key)}:${toCssValue(key, value)};`
  }
  let output = ''
  if (declarations) output += `${selector}{${declarations}}`
  output += nestedBlocks
  return output
}

function toNestedSelector(parent: string, key: string) {
  if (key.startsWith('&')) return key.replaceAll('&', parent)
  if (key.startsWith(':')) return `${parent}${key}`
  return `${parent} ${key}`
}

function toCssPropertyName(value: string) {
  if (value.startsWith('--')) return value
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function toCssValue(key: string, value: CssScalar) {
  if (typeof value === 'number' && !isUnitlessProperty(key)) {
    return `${value}px`
  }
  return String(value)
}

function isUnitlessProperty(key: string) {
  return (
    key === 'opacity' ||
    key === 'zIndex' ||
    key === 'fontWeight' ||
    key === 'lineHeight' ||
    key === 'flex' ||
    key === 'flexGrow' ||
    key === 'flexShrink' ||
    key === 'order'
  )
}

function stableSerialize(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    let output = '['
    for (let index = 0; index < value.length; index++) {
      if (index > 0) output += ','
      output += stableSerialize(value[index])
    }
    output += ']'
    return output
  }
  if (typeof value === 'object') {
    let keys = Object.keys(value as Record<string, unknown>).sort()
    let output = '{'
    for (let index = 0; index < keys.length; index++) {
      let key = keys[index]
      if (index > 0) output += ','
      output += `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`
    }
    output += '}'
    return output
  }
  return ''
}

function hashString(input: string) {
  let hash = 5381
  for (let index = 0; index < input.length; index++) {
    hash = ((hash << 5) + hash + input.charCodeAt(index)) | 0
  }
  return (hash >>> 0).toString(36)
}
