// Out-of-order HTML streaming built on the declarative processing-instruction
// directives shipping in modern browsers:
//
//   <?start name="ID"> ...placeholder... <?end name="ID">
//   <template for="ID">...resolved content...</template>
//
// A supporting browser natively moves the `<template for>` content into the
// region delimited by the matching `<?start>` / `<?end>` instructions, with no
// JavaScript. Browsers without native support parse the instructions as comment
// nodes (`?start name="ID"` / `?end name="ID"`); a small MutationObserver
// polyfill performs the same move. Either way the DOM swap is owned by the
// browser or the polyfill, never by the reconciler — the runtime only hydrates
// whatever content exists after the swap.

const PROCESSING_INSTRUCTION_NODE = 7
const COMMENT_NODE = 8

const NAME_ATTR_PATTERN = /name="([^"]*)"/

/**
 * A parsed stream directive describing one boundary of an out-of-order region.
 */
export interface StreamDirective {
  /** Which boundary this directive marks. */
  kind: 'start' | 'end'
  /** Region identifier shared by the matching `<template for>` element. */
  id: string
}

/**
 * Serializes the opening directive for an out-of-order streaming region.
 *
 * @param id Region identifier shared with the resolving `<template for>`.
 * @returns The `<?start name="id">` processing instruction.
 */
export function streamStartDirective(id: string): string {
  return `<?start name="${id}">`
}

/**
 * Serializes the closing directive for an out-of-order streaming region.
 *
 * @param id Region identifier shared with the resolving `<template for>`.
 * @returns The `<?end name="id">` processing instruction.
 */
export function streamEndDirective(id: string): string {
  return `<?end name="${id}">`
}

/**
 * Reads a stream directive from a DOM node, handling both native processing
 * instructions (nodeType 7) and the comment fallback (nodeType 8) produced by
 * browsers that do not yet parse the instructions.
 *
 * @param node Node to inspect.
 * @returns The parsed directive, or `null` when the node is not a directive.
 */
export function getStreamDirective(node: Node | null | undefined): StreamDirective | null {
  if (!node) return null

  if (node.nodeType === PROCESSING_INSTRUCTION_NODE) {
    let instruction = node as ProcessingInstruction
    if (instruction.target === 'start' || instruction.target === 'end') {
      let id = readDirectiveId(instruction.data)
      if (id != null) return { kind: instruction.target, id }
    }
    return null
  }

  if (node.nodeType === COMMENT_NODE) {
    let data = (node as Comment).data
    if (data.startsWith('?start ') || data.startsWith('?start\t')) {
      let id = readDirectiveId(data)
      if (id != null) return { kind: 'start', id }
    } else if (data.startsWith('?end ') || data.startsWith('?end\t')) {
      let id = readDirectiveId(data)
      if (id != null) return { kind: 'end', id }
    }
  }

  return null
}

/**
 * Reports whether a node is any stream directive boundary.
 *
 * @param node Node to inspect.
 * @returns `true` when the node is a `<?start>` or `<?end>` directive.
 */
export function isStreamDirective(node: Node | null | undefined): boolean {
  return getStreamDirective(node) != null
}

function readDirectiveId(data: string): string | null {
  let match = NAME_ATTR_PATTERN.exec(data)
  return match ? match[1]! : null
}

/**
 * Detects whether the current browser natively processes the declarative
 * `<?start>` / `<?end>` streaming directives. When it does, the browser owns
 * the out-of-order DOM swap and the polyfill must not run.
 *
 * @param doc Document used to build the probe. Defaults to the global document.
 * @returns `true` when the parser produces a processing instruction node.
 */
export function supportsStreamDirectives(doc: Document = document): boolean {
  let probe = doc.createElement('template')
  probe.innerHTML = streamStartDirective('rmx-probe')
  let first = probe.content.firstChild
  return !!first && first.nodeType === PROCESSING_INSTRUCTION_NODE
}

// NodeFilter bit flags, inlined to avoid depending on the global constant.
const SHOW_COMMENT = 0x80
const SHOW_PROCESSING_INSTRUCTION = 0x40

/**
 * The matching `<?start>` and `<?end>` directives that delimit one out-of-order
 * streaming region.
 */
export interface StreamRegion {
  /** The opening directive node. */
  start: Node
  /** The closing directive node. */
  end: Node
}

/**
 * Finds the directive pair that delimits the region with the given id.
 *
 * @param id Region identifier to locate.
 * @param doc Document to search. Defaults to the global document.
 * @returns The matching region, or `null` when either boundary is missing.
 */
export function findStreamRegion(id: string, doc: Document = document): StreamRegion | null {
  let iterator = doc.createNodeIterator(doc, SHOW_COMMENT | SHOW_PROCESSING_INSTRUCTION)
  let start: Node | null = null
  let end: Node | null = null
  let node = iterator.nextNode()
  while (node) {
    let directive = getStreamDirective(node)
    if (directive && directive.id === id) {
      if (directive.kind === 'start') start = node
      else end = node
      if (start && end) return { start, end }
    }
    node = iterator.nextNode()
  }
  return null
}

/**
 * Moves a `<template for>` element's content into its matching directive region,
 * replacing the placeholder content and removing the directives and template.
 * This is the polyfill for browsers without native directive support; native
 * browsers perform the same move without JavaScript.
 *
 * @param template Template element addressed by a `for` attribute.
 * @param doc Document that owns the template. Defaults to the global document.
 * @returns The resolved region id when a swap occurred, otherwise `null`.
 */
export function swapStreamTemplate(
  template: HTMLTemplateElement,
  doc: Document = document,
): string | null {
  let id = template.getAttribute('for')
  if (id == null) return null

  let region = findStreamRegion(id, doc)
  if (!region) {
    template.remove()
    return null
  }

  let { start, end } = region
  let parent = end.parentNode
  if (!parent || start.parentNode !== parent) {
    template.remove()
    return null
  }

  // Replace the placeholder content between the directives.
  let node = start.nextSibling
  while (node && node !== end) {
    let next = node.nextSibling
    parent.removeChild(node)
    node = next
  }
  parent.insertBefore(template.content.cloneNode(true), end)

  // Remove the directives and the consumed template.
  parent.removeChild(start)
  parent.removeChild(end)
  template.remove()

  return id
}

function forEachStreamTemplate(node: Node, visit: (template: HTMLTemplateElement) => void): void {
  if (node instanceof HTMLTemplateElement) {
    if (node.hasAttribute('for')) visit(node)
    return
  }
  if (!(node instanceof Element)) return
  for (let template of Array.from(node.querySelectorAll('template[for]'))) {
    if (template instanceof HTMLTemplateElement) visit(template)
  }
}

/**
 * Installs the MutationObserver polyfill that moves `<template for>` content
 * into its directive region as templates stream into the document. No-op and
 * returns an inert disposer when the browser supports the directives natively.
 *
 * @param doc Document to observe. Defaults to the global document.
 * @param onSwap Optional callback invoked with the region id after each swap.
 * @returns A function that disconnects the observer.
 */
export function installStreamTemplateMover(
  doc: Document = document,
  onSwap?: (id: string) => void,
): () => void {
  if (supportsStreamDirectives(doc)) return () => {}

  let root = doc.body ?? doc.documentElement ?? doc
  let observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        forEachStreamTemplate(node, (template) => {
          let id = swapStreamTemplate(template, doc)
          if (id != null) onSwap?.(id)
        })
      }
    }
  })

  observer.observe(root, { childList: true, subtree: true })

  let dispose = () => {
    observer.disconnect()
    doc.removeEventListener('DOMContentLoaded', dispose)
  }

  // Server-streamed out-of-order chunks only arrive while the initial document
  // is still parsing. Once it finishes loading there will be no more, so drop
  // the observer after DOMContentLoaded. Reloads and navigation reconcile their
  // content through the runtime rather than the live document, so they do not
  // depend on the polyfill.
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', dispose, { once: true })
  }

  // Swap any templates that already streamed in before the observer was
  // installed (for example when the full document is present at startup).
  for (let template of Array.from(doc.querySelectorAll('template[for]'))) {
    if (template instanceof HTMLTemplateElement) {
      let id = swapStreamTemplate(template, doc)
      if (id != null) onSwap?.(id)
    }
  }

  return dispose
}
