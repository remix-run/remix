import { bench, describe } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse as customParse } from '../../src/lib/html-parser.ts'
import { parse as nodeHtmlParse } from 'node-html-parser'
import type { HTMLElement } from '../../src/lib/html-parser.ts'
import type { HTMLElement as NodeHTMLElement } from 'node-html-parser'

// Load HTML fixtures and duplicate to reach target sizes (~20KB, ~30KB, ~45KB)
let landingPage = readFileSync(new URL('../fixtures/landing-page.html', import.meta.url), 'utf-8').repeat(2)
let blogPost = readFileSync(new URL('../fixtures/blog-post.html', import.meta.url), 'utf-8').repeat(2)
let docsPage = readFileSync(new URL('../fixtures/docs-page.html', import.meta.url), 'utf-8').repeat(2)

// Helper function to extract links and assets (matching crawl.ts logic)
function extractLinksAndAssets(elements: HTMLElement[]): { links: string[]; assets: string[] } {
  let links = elements
    .filter((el) => el.name === 'a')
    .map((el) => el.getAttribute('href'))
    .filter((href): href is string => href != null)

  let assets = elements
    .filter(
      (el) =>
        (el.name === 'link' && el.getAttribute('href')) ||
        ((el.name === 'script' || el.name === 'img') && el.getAttribute('src')),
    )
    .map((el) => el.getAttribute('href') || el.getAttribute('src'))
    .filter((attr): attr is string => attr != null)

  return { links, assets }
}

// Helper for node-html-parser extraction
function extractLinksAndAssetsNodeHtml(
  root: NodeHTMLElement,
): { links: string[]; assets: string[] } {
  let links = root
    .querySelectorAll('a')
    .map((el) => el.getAttribute('href'))
    .filter((href): href is string => href != null)

  let linkElements = root.querySelectorAll('link[href]')
  let scriptElements = root.querySelectorAll('script[src]')
  let imgElements = root.querySelectorAll('img[src]')

  let assets = [
    ...linkElements.map((el) => el.getAttribute('href')),
    ...scriptElements.map((el) => el.getAttribute('src')),
    ...imgElements.map((el) => el.getAttribute('src')),
  ].filter((attr): attr is string => attr != null)

  return { links, assets }
}

describe('Raw Parsing - Landing Page (~20KB)', () => {
  bench('custom parser', () => {
    customParse(landingPage)
  })

  bench('node-html-parser', () => {
    nodeHtmlParse(landingPage)
  })
})

describe('Raw Parsing - Blog Post (~30KB)', () => {
  bench('custom parser', () => {
    customParse(blogPost)
  })

  bench('node-html-parser', () => {
    nodeHtmlParse(blogPost)
  })
})

describe('Raw Parsing - Docs Page (~45KB)', () => {
  bench('custom parser', () => {
    customParse(docsPage)
  })

  bench('node-html-parser', () => {
    nodeHtmlParse(docsPage)
  })
})

describe('Full Crawl Scenario - Landing Page', () => {
  bench('custom parser + extraction', () => {
    let elements = customParse(landingPage)
    extractLinksAndAssets(elements)
  })

  bench('node-html-parser + extraction', () => {
    let root = nodeHtmlParse(landingPage)
    extractLinksAndAssetsNodeHtml(root)
  })
})

describe('Full Crawl Scenario - Blog Post', () => {
  bench('custom parser + extraction', () => {
    let elements = customParse(blogPost)
    extractLinksAndAssets(elements)
  })

  bench('node-html-parser + extraction', () => {
    let root = nodeHtmlParse(blogPost)
    extractLinksAndAssetsNodeHtml(root)
  })
})

describe('Full Crawl Scenario - Docs Page', () => {
  bench('custom parser + extraction', () => {
    let elements = customParse(docsPage)
    extractLinksAndAssets(elements)
  })

  bench('node-html-parser + extraction', () => {
    let root = nodeHtmlParse(docsPage)
    extractLinksAndAssetsNodeHtml(root)
  })
})
