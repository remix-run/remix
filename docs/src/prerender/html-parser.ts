export interface HTMLElement {
  name: string
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  innerHTML: string
}

export interface ParseOptions {
  comment?: boolean
}

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const RAW_TEXT_ELEMENTS = new Set(['script', 'style'])

type HtmlNode = Element | string

class Element implements HTMLElement {
  name: string
  #attributes: Map<string, string>
  #children: HtmlNode[] = []
  #selfClosing: boolean

  constructor(name: string, selfClosing = false) {
    this.name = name.toLowerCase()
    this.#attributes = new Map()
    this.#selfClosing = selfClosing
  }

  setAttribute(name: string, value: string) {
    this.#attributes.set(name.toLowerCase(), value)
  }

  getAttribute(name: string): string | null {
    return this.#attributes.get(name.toLowerCase()) ?? null
  }

  get innerHTML(): string {
    return this.#children
      .map((child) => {
        if (typeof child === 'string') return child
        return child.toString()
      })
      .join('')
  }

  set innerHTML(value: string) {
    this.#children = [value]
  }

  appendChild(child: HtmlNode) {
    this.#children.push(child)
  }

  isSelfClosing(): boolean {
    return this.#selfClosing
  }

  toString(): string {
    if (this.name === '#comment') {
      return this.#attributes.get('text') || ''
    }

    let attrs = Array.from(this.#attributes.entries())
      .map(([k, v]) => (v === '' ? k : `${k}="${v.replace(/"/g, '&quot;')}"`))
      .join(' ')
    let attrStr = attrs ? ' ' + attrs : ''

    if (this.name.startsWith('!')) {
      return `<${this.name}${attrStr}>`
    }

    if (VOID_ELEMENTS.has(this.name) || this.#selfClosing) {
      return `<${this.name}${attrStr} />`
    }

    let content = this.#children
      .map((child) => {
        if (typeof child === 'string') return child
        return child.toString()
      })
      .join('')
    return `<${this.name}${attrStr}>${content}</${this.name}>`
  }
}

class Document {
  #elements: HTMLElement[]
  #children: HtmlNode[]

  constructor(elements: HTMLElement[], children: HtmlNode[]) {
    this.#elements = elements
    this.#children = children
  }

  get elements(): HTMLElement[] {
    return this.#elements
  }

  toString(): string {
    return this.#children
      .map((child) => {
        if (typeof child === 'string') return child
        return child.toString()
      })
      .join('')
  }
}

function findTagEnd(html: string, start: number): number {
  let quote: string | null = null

  for (let i = start; i < html.length; i++) {
    let char = html[i]
    if (char === undefined) break

    if (quote) {
      if (char === quote) quote = null
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '>') return i
  }

  return -1
}

function parseTag(content: string): Element | null {
  let source = content.trim()
  let selfClosing = false

  if (source.endsWith('/')) {
    selfClosing = true
    source = source.slice(0, -1).trimEnd()
  }

  let nameEnd = 0
  while (nameEnd < source.length && !/\s/.test(source[nameEnd] ?? '')) {
    nameEnd++
  }

  let name = source.slice(0, nameEnd)
  if (!name) return null

  let element = new Element(name, selfClosing)
  let i = nameEnd

  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i] ?? '')) i++
    if (i >= source.length) break

    let attrNameStart = i
    while (i < source.length && !/[\s=]/.test(source[i] ?? '')) i++
    let attrName = source.slice(attrNameStart, i)
    if (!attrName) break

    while (i < source.length && /\s/.test(source[i] ?? '')) i++

    if (source[i] !== '=') {
      element.setAttribute(attrName, '')
      continue
    }

    i++
    while (i < source.length && /\s/.test(source[i] ?? '')) i++

    let quote = source[i]
    if (quote === '"' || quote === "'") {
      i++
      let valueStart = i
      while (i < source.length && source[i] !== quote) i++
      element.setAttribute(attrName, source.slice(valueStart, i))
      if (source[i] === quote) i++
      continue
    }

    let valueStart = i
    while (i < source.length && !/\s/.test(source[i] ?? '')) i++
    element.setAttribute(attrName, source.slice(valueStart, i))
  }

  return element
}

export function parse(html: string, options?: ParseOptions): Document {
  let elements: HTMLElement[] = []
  let children: HtmlNode[] = []
  let stack: Element[] = []
  let i = 0

  let appendChild = (child: HtmlNode) => {
    let parent = stack.at(-1)
    if (parent) {
      parent.appendChild(child)
    } else {
      children.push(child)
    }
  }

  let appendElement = (element: Element) => {
    elements.push(element)
    appendChild(element)
  }

  let closeElement = (name: string) => {
    let normalizedName = name.toLowerCase()
    for (let index = stack.length - 1; index >= 0; index--) {
      if (stack[index]?.name === normalizedName) {
        stack.length = index
        return
      }
    }
  }

  while (i < html.length) {
    let lt = html.indexOf('<', i)
    if (lt === -1) {
      appendChild(html.slice(i))
      break
    }

    if (lt > i) appendChild(html.slice(i, lt))

    if (html.startsWith('<!--', lt)) {
      let end = html.indexOf('-->', lt + 4)
      if (end === -1) {
        appendChild(html.slice(lt))
        break
      }

      if (options?.comment) {
        let comment = new Element('#comment')
        comment.setAttribute('text', html.slice(lt, end + 3))
        appendElement(comment)
      }
      i = end + 3
      continue
    }

    if (html[lt + 1] === '/') {
      let end = findTagEnd(html, lt + 2)
      if (end === -1) {
        appendChild(html.slice(lt))
        break
      }

      let tagName = html
        .slice(lt + 2, end)
        .trim()
        .split(/\s+/, 1)[0]
      if (tagName) closeElement(tagName)
      i = end + 1
      continue
    }

    let end = findTagEnd(html, lt + 1)
    if (end === -1) {
      appendChild(html.slice(lt))
      break
    }

    let element = parseTag(html.slice(lt + 1, end))
    if (!element) {
      appendChild(html.slice(lt, end + 1))
      i = end + 1
      continue
    }

    appendElement(element)
    i = end + 1

    if (
      element.name.startsWith('!') ||
      VOID_ELEMENTS.has(element.name) ||
      element.isSelfClosing()
    ) {
      continue
    }

    if (RAW_TEXT_ELEMENTS.has(element.name)) {
      let closeStart = html.toLowerCase().indexOf(`</${element.name}`, i)
      if (closeStart === -1) {
        element.appendChild(html.slice(i))
        break
      }

      element.appendChild(html.slice(i, closeStart))
      let closeEnd = findTagEnd(html, closeStart + 2)
      if (closeEnd === -1) break
      i = closeEnd + 1
      continue
    }

    stack.push(element)
  }

  return new Document(elements, children)
}
