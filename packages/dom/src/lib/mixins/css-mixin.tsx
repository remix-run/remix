import { createMixin } from '@remix-run/reconciler'
import type { MixinDescriptor } from '@remix-run/reconciler'
import type { DomElementType } from '../jsx/jsx-runtime.ts'
import {
  appendClassName,
  compileCss,
  createCssClassName,
  createCssKey,
  CSS_MIXIN_STYLE_TAG_ATTR,
  CSS_MIXIN_STYLE_TAG_ORIGIN_ATTR,
  isCssInput,
  markCssMixinDescriptor,
  type CssInput,
} from './css-shared.ts'
import {
  DomRuntimePreApplyEvent,
  readRuntimeHandleForDocument,
} from '../client-runtime.ts'

type CssEntry = {
  className: string
  cssText: string
  refCount: number
  fromServer: boolean
}

type DocumentStyles = {
  styleElement: HTMLStyleElement
  entriesByClassName: Map<string, CssEntry>
  entriesByKey: Map<string, CssEntry>
  serverCssChunks: Set<string>
  processedServerStyles: WeakSet<HTMLStyleElement>
  runtime: null | EventTarget
  runtimePreApplyListener: null | EventListener
}

let documentStylesByRef = new WeakMap<Document, DocumentStyles>()

let cssMixin = createMixin<[styles: CssInput | null | undefined], Element, DomElementType>(
  (handle) => {
    let currentDoc: null | Document = null
    let currentKey = ''

    handle.addEventListener('remove', () => {
      detach()
    })

    return (styles, props) => {
      if (!isCssInput(styles)) {
        detach()
        return <handle.element {...props} />
      }

      let nextKey = createCssKey(styles)
      let nextClassName = createCssClassName(nextKey)
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
      })

      let nextProps = {
        ...props,
        className: appendClassName(props.className, nextClassName),
      }
      return <handle.element {...nextProps} />
    }

    function detach() {
      if (!currentDoc || !currentKey) return
      let styles = documentStylesByRef.get(currentDoc)
      let entry = styles?.entriesByKey.get(currentKey)
      if (entry) {
        entry.refCount--
        if (entry.refCount <= 0 && !entry.fromServer && styles) {
          styles.entriesByClassName.delete(entry.className)
          for (let [key, keyEntry] of styles.entriesByKey) {
            if (keyEntry === entry) {
              styles.entriesByKey.delete(key)
            }
          }
          syncStyleSheet(styles)
        }
      }
      currentDoc = null
      currentKey = ''
    }
  },
)

export function css<node extends Element = Element>(
  styles: CssInput | null | undefined,
): MixinDescriptor<node, [styles: CssInput | null | undefined]> {
  let descriptor = cssMixin(styles) as MixinDescriptor<node, [styles: CssInput | null | undefined]>
  return markCssMixinDescriptor(
    descriptor as MixinDescriptor<Element, [styles: CssInput | null | undefined], string>,
  ) as MixinDescriptor<node, [styles: CssInput | null | undefined]>
}

function getOrCreateCssEntry(doc: Document, styles: CssInput, key: string) {
  let documentStyles = getDocumentStyles(doc)
  let existing = documentStyles.entriesByKey.get(key)
  if (existing) return existing
  let className = createCssClassName(key)
  let existingByClass = documentStyles.entriesByClassName.get(className)
  if (existingByClass) {
    documentStyles.entriesByKey.set(key, existingByClass)
    return existingByClass
  }
  let cssText = compileCss(`.${className}`, styles)
  let created: CssEntry = {
    className,
    cssText,
    refCount: 0,
    fromServer: false,
  }
  documentStyles.entriesByClassName.set(className, created)
  documentStyles.entriesByKey.set(key, created)
  syncStyleSheet(documentStyles)
  return created
}

function getDocumentStyles(doc: Document) {
  let existing = documentStylesByRef.get(doc)
  if (existing) {
    startRuntimePreApplyListener(doc, existing)
    return existing
  }
  let styleElement = doc.createElement('style')
  styleElement.setAttribute(CSS_MIXIN_STYLE_TAG_ATTR, '')
  styleElement.setAttribute(CSS_MIXIN_STYLE_TAG_ORIGIN_ATTR, 'client')
  let created: DocumentStyles = {
    styleElement,
    entriesByClassName: new Map(),
    entriesByKey: new Map(),
    serverCssChunks: new Set(),
    processedServerStyles: new WeakSet(),
    runtime: null,
    runtimePreApplyListener: null,
  }
  adoptExistingServerStyles(doc, created)
  startRuntimePreApplyListener(doc, created)
  doc.head.appendChild(styleElement)
  documentStylesByRef.set(doc, created)
  return created
}

function syncStyleSheet(documentStyles: DocumentStyles) {
  let cssText = ''
  for (let chunk of documentStyles.serverCssChunks) {
    cssText += chunk
  }
  for (let [, entry] of documentStyles.entriesByClassName) {
    if (entry.fromServer) continue
    cssText += entry.cssText
  }
  documentStyles.styleElement.textContent = cssText
}

function adoptExistingServerStyles(doc: Document, documentStyles: DocumentStyles) {
  adoptServerStylesInNode(doc, documentStyles)
}

function startRuntimePreApplyListener(doc: Document, documentStyles: DocumentStyles) {
  let runtime = readRuntimeHandleForDocument(doc)
  if (!runtime) return
  if (documentStyles.runtime === runtime && documentStyles.runtimePreApplyListener) return
  if (documentStyles.runtime && documentStyles.runtimePreApplyListener) {
    documentStyles.runtime.removeEventListener('dom-runtime:pre-apply', documentStyles.runtimePreApplyListener)
  }
  let listener = (event: Event) => {
    if (!(event instanceof DomRuntimePreApplyEvent)) return
    if (event.doc !== doc) return
    adoptServerStylesInNode(event.fragment, documentStyles)
  }
  documentStyles.runtime = runtime
  documentStyles.runtimePreApplyListener = listener
  runtime.addEventListener('dom-runtime:pre-apply', listener)
}

function adoptServerStylesInNode(node: Node, documentStyles: DocumentStyles) {
  if (node instanceof HTMLStyleElement) {
    if (!node.hasAttribute(CSS_MIXIN_STYLE_TAG_ATTR)) return
    if (node === documentStyles.styleElement) return
    if (node.getAttribute(CSS_MIXIN_STYLE_TAG_ORIGIN_ATTR) === 'client') return
    adoptServerStyleTag(node, documentStyles)
    return
  }
  if (!(node instanceof Element || node instanceof Document || node instanceof DocumentFragment)) return
  let serverStyles = node.querySelectorAll(`style[${CSS_MIXIN_STYLE_TAG_ATTR}]`)
  for (let index = 0; index < serverStyles.length; index++) {
    let styleElement = serverStyles[index]
    if (!(styleElement instanceof HTMLStyleElement)) continue
    if (styleElement === documentStyles.styleElement) continue
    if (styleElement.getAttribute(CSS_MIXIN_STYLE_TAG_ORIGIN_ATTR) === 'client') continue
    adoptServerStyleTag(styleElement, documentStyles)
  }
}

function adoptServerStyleTag(styleElement: HTMLStyleElement, documentStyles: DocumentStyles) {
  if (documentStyles.processedServerStyles.has(styleElement)) return
  documentStyles.processedServerStyles.add(styleElement)
  let cssText = styleElement.textContent?.trim() ?? ''
  if (cssText.length > 0) {
    documentStyles.serverCssChunks.add(cssText)
    seedServerClasses(cssText, documentStyles)
    syncStyleSheet(documentStyles)
  }
  styleElement.remove()
}

function seedServerClasses(cssText: string, documentStyles: DocumentStyles) {
  let matches = cssText.matchAll(/\.([a-zA-Z0-9_-]+)/g)
  for (let match of matches) {
    let className = match[1]
    if (!className?.startsWith('rmx-css-')) continue
    if (documentStyles.entriesByClassName.has(className)) continue
    documentStyles.entriesByClassName.set(className, {
      className,
      cssText: '',
      refCount: 0,
      fromServer: true,
    })
  }
}
