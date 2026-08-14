import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { getDocumentModulePreloader } from '../runtime/module-preloader.ts'

describe('module preloader', () => {
  it('observes server-rendered preloads and removes framework-owned elements after loading', () => {
    let doc = createTestDocument()
    doc.head.innerHTML = '<link data-rmx rel="modulepreload" href="/assets/island.js" />'
    let link = doc.head.querySelector('link')
    let preloader = getDocumentModulePreloader(doc)

    preloader.adoptInitialPreloadLinks(doc)

    let links = doc.head.querySelectorAll('link')
    expect(links).toHaveLength(2)
    expect(preloader.hasActivePreloads()).toBe(true)
    expect(links[0]).toBe(link)
    expect(preloader.isActivePreload(links[0]!)).toBe(true)
    expect(preloader.isActivePreload(links[1]!)).toBe(true)

    links[1]?.dispatchEvent(new Event('load'))
    expect(doc.head.querySelector('link')).toBeNull()
    expect(preloader.hasActivePreloads()).toBe(false)
  })

  it('uses an observer when adopting preloads that may have loaded before runtime startup', () => {
    let doc = createTestDocument()
    doc.head.innerHTML = '<link data-rmx rel="modulepreload" href="/assets/island.js" />'
    let initialLink = doc.head.querySelector('link')
    let preloader = getDocumentModulePreloader(doc)

    initialLink?.dispatchEvent(new Event('load'))
    preloader.adoptInitialPreloadLinks(doc)

    let observerLink = doc.head.querySelectorAll('link')[1]
    expect(observerLink).toBeDefined()
    observerLink?.dispatchEvent(new Event('load'))
    expect(doc.head.querySelector('link')).toBeNull()
  })

  it('allows an initial preload failure to be retried', () => {
    let doc = createTestDocument()
    doc.head.innerHTML = '<link data-rmx rel="modulepreload" href="/assets/island.js" />'
    let preloader = getDocumentModulePreloader(doc)
    preloader.adoptInitialPreloadLinks(doc)

    doc.head.querySelectorAll('link')[1]?.dispatchEvent(new Event('error'))
    expect(preloader.hasActivePreloads()).toBe(false)

    let retry = doc.createElement('template')
    retry.innerHTML = '<link data-rmx rel="modulepreload" href="/assets/island.js" />'
    preloader.consumePreloadLinks(retry.content)
    expect(doc.head.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(1)
    expect(preloader.hasActivePreloads()).toBe(true)
  })

  it('does not adopt authored initial preloads', () => {
    let doc = createTestDocument()
    doc.head.innerHTML = '<link rel="modulepreload" href="/assets/authored.js" />'
    let authoredLink = doc.head.querySelector('link')
    let preloader = getDocumentModulePreloader(doc)

    preloader.adoptInitialPreloadLinks(doc)

    expect(doc.head.querySelectorAll('link')).toHaveLength(1)
    expect(doc.head.querySelector('link')).toBe(authoredLink)
    expect(preloader.isActivePreload(authoredLink!)).toBe(false)
  })

  it('adopts each initial preload once', () => {
    let doc = createTestDocument()
    doc.head.innerHTML = '<link data-rmx rel="modulepreload" href="/assets/island.js" />'
    let preloader = getDocumentModulePreloader(doc)

    preloader.adoptInitialPreloadLinks(doc)
    preloader.adoptInitialPreloadLinks(doc)

    expect(doc.head.querySelectorAll('link')).toHaveLength(2)
  })

  it('starts each new module preload once and removes its transient element after loading', () => {
    let doc = createTestDocument()
    let preloader = getDocumentModulePreloader(doc)
    let response = doc.createElement('template')
    response.innerHTML = [
      '<link data-rmx rel="modulepreload" href="/assets/island.js" />',
      '<link data-rmx rel="modulepreload" href="/assets/island.js" />',
    ].join('')

    preloader.consumePreloadLinks(response.content)

    let links = doc.head.querySelectorAll('link[rel="modulepreload"]')
    expect(links).toHaveLength(1)
    expect(preloader.hasActivePreloads()).toBe(true)
    expect(links[0]?.hasAttribute('data-rmx')).toBe(true)
    expect(preloader.isActivePreload(links[0]!)).toBe(true)
    expect(response.content.querySelector('link')).toBeNull()

    links[0]?.dispatchEvent(new Event('load'))
    expect(doc.head.querySelector('link[rel="modulepreload"]')).toBeNull()
    expect(preloader.hasActivePreloads()).toBe(false)
    expect(preloader.isActivePreload(links[0]!)).toBe(false)

    let repeatedResponse = doc.createElement('template')
    repeatedResponse.innerHTML = '<link data-rmx rel="modulepreload" href="/assets/island.js" />'
    preloader.consumePreloadLinks(repeatedResponse.content)
    expect(doc.head.querySelector('link[rel="modulepreload"]')).toBeNull()
  })

  it('leaves authored document preloads outside framework deduplication', () => {
    let doc = createTestDocument()
    doc.head.innerHTML = '<link rel="modulepreload" href="/assets/shared.js" />'
    let preloader = getDocumentModulePreloader(doc)
    let response = doc.createElement('template')
    response.innerHTML = '<link data-rmx rel="modulepreload" href="/assets/shared.js" />'

    preloader.consumePreloadLinks(response.content)

    let links = doc.head.querySelectorAll('link[rel="modulepreload"]')
    expect(links).toHaveLength(2)
    expect(links[0]?.hasAttribute('data-rmx')).toBe(false)
    expect(links[1]?.hasAttribute('data-rmx')).toBe(true)
  })

  it('allows a failed preload to be retried by a later frame response', () => {
    let doc = createTestDocument()
    let preloader = getDocumentModulePreloader(doc)
    let response = doc.createElement('template')
    response.innerHTML = '<link data-rmx rel="modulepreload" href="/assets/island.js" />'
    preloader.consumePreloadLinks(response.content)

    doc.head.querySelector('link')?.dispatchEvent(new Event('error'))

    let retry = doc.createElement('template')
    retry.innerHTML = '<link data-rmx rel="modulepreload" href="/assets/island.js" />'
    preloader.consumePreloadLinks(retry.content)
    expect(doc.head.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(1)
  })

  it('shares requested module URLs across independent roots in one document', () => {
    let doc = createTestDocument()
    let firstRootPreloader = getDocumentModulePreloader(doc)
    let secondRootPreloader = getDocumentModulePreloader(doc)
    let firstResponse = doc.createElement('template')
    firstResponse.innerHTML = '<link data-rmx rel="modulepreload" href="/assets/shared.js" />'
    let secondResponse = firstResponse.cloneNode(true) as HTMLTemplateElement

    firstRootPreloader.consumePreloadLinks(firstResponse.content)
    secondRootPreloader.consumePreloadLinks(secondResponse.content)

    expect(doc.head.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(1)
  })
})

function createTestDocument(): Document {
  let doc = document.implementation.createHTMLDocument()
  let base = doc.createElement('base')
  base.href = 'https://example.com/'
  doc.head.append(base)
  return doc
}
