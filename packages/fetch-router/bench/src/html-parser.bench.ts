import { bench, describe } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse as customParse } from '../../src/lib/html-parser.ts'
import { parse as nodeHtmlParse } from 'node-html-parser'
import type { HTMLElement } from '../../src/lib/html-parser.ts'
import type { HTMLElement as NodeHTMLElement } from 'node-html-parser'

// Load HTML fixtures and duplicate to reach target sizes (~20KB, ~30KB, ~45KB)
let landingPage = readFileSync(new URL('../fixtures/landing-page.html', import.meta.url), 'utf-8')
let blogPost = readFileSync(new URL('../fixtures/blog-post.html', import.meta.url), 'utf-8')
let docsPage = readFileSync(new URL('../fixtures/docs-page.html', import.meta.url), 'utf-8')

// Helper function to extract links and assets (matching crawl.ts logic)
function extractLinksAndAssets(elements: HTMLElement[]): { links: string[]; assets: string[] } {
  return {
    links: elements
      .filter((el) => el.name === 'a' && el.getAttribute('href'))
      .map((el) => el.getAttribute('href') as string),
    assets: elements
      .filter(
        (el) =>
          (el.name === 'link' && el.getAttribute('href')) ||
          ((el.name === 'script' || el.name === 'img') && el.getAttribute('src')),
      )
      .map((el) => (el.getAttribute('href') || el.getAttribute('src')) as string),
  }
}

// Extract links and assets using node-html-parser's querySelectorAll
function extractLinksAndAssetsNodeHtml(root: NodeHTMLElement): {
  links: string[]
  assets: string[]
} {
  return {
    links: root
      .querySelectorAll('a[href]')
      .map((el) => el.getAttribute('href'))
      .filter((href): href is string => href != null),
    assets: [
      ...root.querySelectorAll('link[href]').map((el) => el.getAttribute('href')),
      ...root.querySelectorAll('script[src]').map((el) => el.getAttribute('src')),
      ...root.querySelectorAll('img[src]').map((el) => el.getAttribute('src')),
    ].filter((attr): attr is string => attr != null),
  }
}

// Validate that both parsers extract identical links and assets for each fixture
let fixtures = [
  { name: 'Landing Page', html: landingPage },
  { name: 'Blog Post', html: blogPost },
  { name: 'Docs Page', html: docsPage },
]

for (let { name, html } of fixtures) {
  let customResult = extractLinksAndAssets(customParse(html))
  let nodeResult = extractLinksAndAssetsNodeHtml(nodeHtmlParse(html))

  console.log(
    `[${name}] custom: ${customResult.links.length} links, ${customResult.assets.length} assets` +
      ` | node-html-parser: ${nodeResult.links.length} links, ${nodeResult.assets.length} assets`,
  )

  if (
    customResult.links.length !== nodeResult.links.length ||
    customResult.assets.length !== nodeResult.assets.length
  ) {
    throw new Error(
      `[${name}] Extraction mismatch! ` +
        `links: ${customResult.links.length} vs ${nodeResult.links.length}, ` +
        `assets: ${customResult.assets.length} vs ${nodeResult.assets.length}`,
    )
  }

  let sortedCustomLinks = customResult.links.toSorted()
  let sortedNodeLinks = nodeResult.links.toSorted()
  let sortedCustomAssets = customResult.assets.toSorted()
  let sortedNodeAssets = nodeResult.assets.toSorted()

  for (let i = 0; i < sortedCustomLinks.length; i++) {
    if (sortedCustomLinks[i] !== sortedNodeLinks[i]) {
      throw new Error(
        `[${name}] Link mismatch at index ${i}: "${sortedCustomLinks[i]}" vs "${sortedNodeLinks[i]}"`,
      )
    }
  }

  for (let i = 0; i < sortedCustomAssets.length; i++) {
    if (sortedCustomAssets[i] !== sortedNodeAssets[i]) {
      throw new Error(
        `[${name}] Asset mismatch at index ${i}: "${sortedCustomAssets[i]}" vs "${sortedNodeAssets[i]}"`,
      )
    }
  }
}

describe('Raw Parsing - Landing Page (~10KB)', () => {
  bench('custom parser', () => {
    customParse(landingPage)
  })

  bench('node-html-parser', () => {
    nodeHtmlParse(landingPage)
  })
})

describe('Raw Parsing - Blog Post (~20KB)', () => {
  bench('custom parser', () => {
    customParse(blogPost)
  })

  bench('node-html-parser', () => {
    nodeHtmlParse(blogPost)
  })
})

describe('Raw Parsing - Docs Page (~30KB)', () => {
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
