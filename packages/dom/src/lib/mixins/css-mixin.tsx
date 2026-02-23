import { createMixin } from '@remix-run/reconciler'
import type { MixinDescriptor } from '@remix-run/reconciler'
import type { JSX as DomJSX } from '../../jsx-runtime.ts'

type CssScalar = string | number
type CssInput = {
  [key: string]: CssScalar | CssInput | null | undefined
}

type CssEntry = {
  className: string
  cssText: string
  refCount: number
}

type DocumentStyles = {
  styleElement: HTMLStyleElement
  entries: Map<string, CssEntry>
}

let documentStylesByRef = new WeakMap<Document, DocumentStyles>()

type DomElementType = Extract<keyof DomJSX.IntrinsicElements, string>

let cssMixin = createMixin<[styles: CssInput | null | undefined], Element, DomElementType>(
  (handle) => {
    let currentDoc: null | Document = null
    let currentKey = ''
    let currentClassName = ''

    handle.addEventListener('remove', () => {
      detach()
    })

    return (styles, props) => {
      if (styles == null || typeof styles !== 'object' || Array.isArray(styles)) {
        detach()
        return <handle.element {...props} />
      }

      let nextKey = stableSerialize(styles)
      let nextClassName = `rmx-css-${hashString(nextKey)}`
      handle.queueTask((node) => {
        if (!(node instanceof Element)) return
        let doc = node.ownerDocument
        if (!doc) return
        if (doc === currentDoc && nextKey === currentKey) return
        detach()
        let entry = getOrCreateCssEntry(doc, styles, nextKey)
        entry.refCount++
        currentDoc = doc
        currentKey = nextKey
        currentClassName = entry.className
      })

      let nextProps = {
        ...props,
        className: appendClassName(props.className, nextClassName),
      }
      return <handle.element {...nextProps} />
    }

    function detach() {
      if (!currentDoc || !currentKey || !currentClassName) return
      let styles = documentStylesByRef.get(currentDoc)
      let entry = styles?.entries.get(currentKey)
      if (entry) {
        entry.refCount--
        if (entry.refCount <= 0) {
          styles?.entries.delete(currentKey)
          if (styles) syncStyleSheet(styles)
        }
      }
      currentDoc = null
      currentKey = ''
      currentClassName = ''
    }
  },
)

export function css<node extends Element = Element>(
  styles: CssInput | null | undefined,
): MixinDescriptor<node, [styles: CssInput | null | undefined]> {
  return cssMixin(styles) as MixinDescriptor<node, [styles: CssInput | null | undefined]>
}

function getOrCreateCssEntry(doc: Document, styles: CssInput, key: string) {
  let documentStyles = getDocumentStyles(doc)
  let existing = documentStyles.entries.get(key)
  if (existing) return existing
  let className = `rmx-css-${hashString(key)}`
  let cssText = compileCss(`.${className}`, styles)
  let created: CssEntry = {
    className,
    cssText,
    refCount: 0,
  }
  documentStyles.entries.set(key, created)
  syncStyleSheet(documentStyles)
  return created
}

function getDocumentStyles(doc: Document) {
  let existing = documentStylesByRef.get(doc)
  if (existing) return existing
  let styleElement = doc.createElement('style')
  styleElement.setAttribute('data-rmx-css-mixin', '')
  doc.head.appendChild(styleElement)
  let created: DocumentStyles = {
    styleElement,
    entries: new Map(),
  }
  documentStylesByRef.set(doc, created)
  return created
}

function syncStyleSheet(documentStyles: DocumentStyles) {
  let cssText = ''
  for (let [, entry] of documentStyles.entries) {
    cssText += entry.cssText
  }
  documentStyles.styleElement.textContent = cssText
}

function compileCss(selector: string, styles: CssInput): string {
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

function appendClassName(existing: unknown, nextClassName: string) {
  if (typeof existing !== 'string' || existing.length === 0) return nextClassName
  let classNames = existing.split(/\s+/).filter(Boolean)
  if (classNames.includes(nextClassName)) return existing
  return `${existing} ${nextClassName}`
}

function isCssInput(value: unknown): value is CssInput {
  if (!value || typeof value !== 'object') return false
  return !Array.isArray(value)
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
