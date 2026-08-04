import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
import {
  findStreamRegion,
  installStreamTemplateMover,
  streamEndDirective,
  streamStartDirective,
  swapStreamTemplate,
} from '../runtime/stream-directives.ts'

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function region(id: string, fallback: string): string {
  return (
    `<!-- rmx:f:${id} -->` +
    streamStartDirective(id) +
    fallback +
    streamEndDirective(id) +
    `<!-- /rmx:f -->`
  )
}

describe('findStreamRegion', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('locates the comment fallback directive pair', () => {
    container.innerHTML = region('abc', '<p>Loading</p>')
    let found = findStreamRegion('abc')
    expect(found).not.toBeNull()
    expect(found!.start.nextSibling?.textContent).toBe('Loading')
  })

  it('returns null when only one boundary is present', () => {
    container.innerHTML = `${streamStartDirective('lonely')}<p>x</p>`
    expect(findStreamRegion('lonely')).toBeNull()
  })
})

describe('swapStreamTemplate', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('replaces region content and removes directives and template', () => {
    container.innerHTML =
      region('one', '<p>Loading</p>') +
      `<span id="after">after</span>` +
      `<template for="one"><p>Resolved</p></template>`

    let after = document.getElementById('after')
    let template = container.querySelector('template[for="one"]')
    expect(template).not.toBeNull()

    let id = swapStreamTemplate(template as HTMLTemplateElement)

    expect(id).toBe('one')
    expect(container.querySelector('p')?.textContent).toBe('Resolved')
    expect(container.querySelector('template[for="one"]')).toBeNull()
    // Sibling identity preserved.
    expect(document.getElementById('after')).toBe(after)
    // Directives removed; rmx:f markers preserved as region boundary.
    expect(container.innerHTML).toContain('<!-- rmx:f:one -->')
    expect(container.innerHTML).toContain('<!-- /rmx:f -->')
    expect(container.innerHTML).not.toContain('?start name="one"')
    expect(container.innerHTML).not.toContain('?end name="one"')
  })

  it('removes a template addressed to an unknown region without touching the DOM', () => {
    container.innerHTML =
      region('known', '<p>Loading</p>') + `<template for="missing"><p>x</p></template>`

    let template = container.querySelector('template[for="missing"]') as HTMLTemplateElement
    let id = swapStreamTemplate(template)

    expect(id).toBeNull()
    expect(container.querySelector('template[for="missing"]')).toBeNull()
    expect(container.querySelector('p')?.textContent).toBe('Loading')
  })
})

describe('installStreamTemplateMover', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('swaps templates inserted after the region', async () => {
    container.innerHTML = region('late', '<p>Loading</p>')
    let swapped: string[] = []
    let dispose = installStreamTemplateMover(document, (id) => swapped.push(id))

    container.insertAdjacentHTML('beforeend', `<template for="late"><p>Resolved</p></template>`)
    await nextFrame()

    expect(swapped).toEqual(['late'])
    expect(container.querySelector('p')?.textContent).toBe('Resolved')
    dispose()
  })

  it('swaps templates that arrive before their observer callback runs', async () => {
    let swapped: string[] = []
    let dispose = installStreamTemplateMover(document, (id) => swapped.push(id))

    container.insertAdjacentHTML(
      'beforeend',
      region('early', '<p>Loading</p>') + `<template for="early"><p>Resolved</p></template>`,
    )
    await nextFrame()

    expect(swapped).toEqual(['early'])
    expect(container.querySelector('p')?.textContent).toBe('Resolved')
    dispose()
  })

  it('stops swapping once DOMContentLoaded fires while the document is loading', async () => {
    // The real test document is already loaded, so drive the "loading" branch
    // through a proxy that reports readyState 'loading' and delegates DOM work
    // to the real document. This lets the polyfill register (and later fire)
    // its DOMContentLoaded listener against captured handlers.
    let domContentLoaded: (() => void) | undefined
    let loadingDoc = new Proxy(document, {
      get(target, key) {
        if (key === 'readyState') return 'loading'
        if (key === 'addEventListener') {
          return (type: string, listener: () => void) => {
            if (type === 'DOMContentLoaded') domContentLoaded = listener
          }
        }
        if (key === 'removeEventListener') return () => {}
        if (key === 'createNodeIterator') {
          return (_root: Node, whatToShow?: number) =>
            document.createNodeIterator(document, whatToShow)
        }
        let value = Reflect.get(target, key)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })

    installStreamTemplateMover(loadingDoc)
    expect(typeof domContentLoaded).toBe('function')

    // Active before load: a streamed template is swapped.
    container.innerHTML = region('before-dcl', '<p>Loading</p>')
    container.insertAdjacentHTML(
      'beforeend',
      `<template for="before-dcl"><p>Resolved</p></template>`,
    )
    await nextFrame()
    expect(container.querySelector('p')?.textContent).toBe('Resolved')

    // After DOMContentLoaded the observer disconnects and ignores new templates.
    domContentLoaded!()
    container.innerHTML = region('after-dcl', '<p>Loading</p>')
    container.insertAdjacentHTML(
      'beforeend',
      `<template for="after-dcl"><p>Resolved</p></template>`,
    )
    await nextFrame()
    expect(container.querySelector('template[for="after-dcl"]')).not.toBeNull()
    expect(container.querySelector('p')?.textContent).toBe('Loading')
  })

  it('stops swapping after the observer is disposed', async () => {
    container.innerHTML = region('gone', '<p>Loading</p>')
    let dispose = installStreamTemplateMover(document)
    dispose()

    container.insertAdjacentHTML('beforeend', `<template for="gone"><p>Resolved</p></template>`)
    await nextFrame()

    // Template remains untouched because the observer was disconnected.
    expect(container.querySelector('template[for="gone"]')).not.toBeNull()
    expect(container.querySelector('p')?.textContent).toBe('Loading')
  })
})
