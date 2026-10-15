import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { router } from '../../router.ts'
import { pages } from '../../data/pages.ts'
import { routes } from '../../routes.ts'

describe('UI docs', () => {
  it('introduces the standalone package and links to both sections', async () => {
    let response = await router.fetch(new Request('http://localhost/'))
    let html = await response.text()
    assert.equal(response.status, 200)
    assert.match(html, /Accessible UI patterns and animation utilities/)
    assert.match(html, /<h2>Patterns<\/h2>/)
    assert.match(html, /is currently unstable and versioned in the v0\.x range/)
    assert.match(html, /npm/)
    assert.match(html, /@remix-run\/ui/)
    assert.match(html, /href="\/patterns\/accordion\/"/)
    assert.match(html, /href="\/animation\/spring\/"/)
    let cards = html.slice(html.indexOf('<section id="explore"'))
    assert.match(cards, /href="\/patterns\/accordion\/">Patterns /)
    assert.match(cards, /href="\/animation\/entrance-exit\/">Animation /)
    assert.match(html, /data-code-block-copy/)
    assert.match(html, /<section id="installation"[^>]*><h2>Installation<\/h2>/)
    assert.match(html, /<section id="using-ui"[^>]*><h2>Using the library<\/h2>/)
    assert.match(html, /<section id="explore"[^>]*><h2>Explore the library<\/h2>/)
    assert.match(html, /href="#installation" aria-current="location"/)
    assert.match(html, /href="#using-ui"/)
    assert.match(html, /href="#explore"/)
  })

  it('makes landing previews decorative and does not hydrate their examples', async () => {
    let response = await router.fetch(new Request('http://localhost/'))
    let html = await response.text()
    let previews = html.match(/<div\b[^>]*\bclass="ui-preview-card-demo"[^>]*>/g)
    assert.equal(previews?.length, 2)
    assert.ok(
      previews?.every((tag) => tag.includes('aria-hidden="true"') && /\binert(?:[ =>])/.test(tag)),
    )
    assert.doesNotMatch(html, /basic\.example[^"<]*\.tsx/)
    assert.doesNotMatch(html, /presence\.example[^"<]*\.tsx/)
  })

  it('links through every page in sidebar order with matching previous links', async () => {
    let href = '/patterns/accordion/'
    let previousHref = '/'
    let visited: string[] = []
    while (href) {
      assert.ok(!visited.includes(href), `Page navigation repeats ${href}`)
      visited.push(href)
      let response = await router.fetch(new Request(`http://localhost${href}`))
      assert.equal(response.status, 200)
      let html = await response.text()
      let navigation = html.match(
        /<nav[^>]*aria-label="Page navigation"[^>]*>([\s\S]*?)<\/nav>/,
      )?.[1]
      assert.ok(navigation, `Missing page navigation on ${href}`)
      assert.equal(navigation.match(/href="([^"]+)" rel="prev"/)?.[1], previousHref)
      previousHref = href
      href = navigation.match(/href="([^"]+)" rel="next"/)?.[1] ?? ''
    }
    assert.deepEqual(
      visited,
      pages.map((page) => routes.docs.page.href({ category: page.category, slug: page.slug })),
    )
    assert.equal(visited.at(-1), '/animation/tween/')
    assert.equal(visited[visited.indexOf('/patterns/toggle/') + 1], '/animation/entrance-exit/')
  })

  it('renders live examples and sections on the pattern page', async () => {
    let response = await router.fetch(new Request('http://localhost/patterns/accordion/'))
    let html = await response.text()
    assert.equal(response.status, 200)
    assert.match(html, /<h1[^>]*>Accordion<\/h1>/)
    assert.match(html, /id="basic"/)
    assert.doesNotMatch(html, /Animated single accordion|Open one panel at a time/)
    assert.match(html, /<h2>Anatomy<\/h2>/)
    assert.match(html, /id="multiple"/)
    assert.match(html, /aria-expanded="true"/)
    assert.match(html, /basic\.example[^"<]*\.tsx/)
    assert.match(html, /id="accessibility"/)
    assert.doesNotMatch(html, /id="single"|id="motion"|id="composition"/)
    let referenceIds = [
      'context-reference',
      'root-reference',
      'item-context-reference',
      'item-reference',
      'trigger-reference',
      'content-reference',
      'change-listener-reference',
      'change-events-reference',
      'types-reference',
    ]
    let referencePositions = referenceIds.map((id) => html.indexOf(`id="${id}"`))
    assert.ok(referencePositions.every((position) => position >= 0))
    assert.deepEqual(
      referencePositions,
      [...referencePositions].sort((a, b) => a - b),
    )
    assert.ok(html.indexOf('id="basic"') < html.indexOf('id="anatomy"'))
    assert.ok(html.indexOf('data-demo-source') < html.indexOf('id="anatomy"'))
    assert.ok(html.indexOf('id="state"') < html.indexOf('id="controlled-single"'))
    assert.match(html, /<h3>Controlled single value<\/h3>/)
    assert.match(html, /data-state/)
    assert.match(html, /role="radiogroup" aria-label="Open order section"/)
    assert.match(html, /aria-pressed="true"/)
    assert.doesNotMatch(html, /Open value:|Close all/)
    assert.match(html, /<h2>Change events<\/h2>/)
    assert.doesNotMatch(html, /<h3>Several open panels<\/h3>|<h3>Listening from an ancestor<\/h3>/)
    assert.doesNotMatch(html, /href="#multiple"|href="#change-events"/)
    assert.match(html, /<h3>Controlled multiple values<\/h3>/)
    assert.match(html, /<h3>Disabling one item<\/h3>/)
    assert.doesNotMatch(html, /Lock order details/)
    assert.match(html, /data-demo-source/)
    assert.doesNotMatch(html, /<details/)
    assert.match(html, /https:\/\/api\.remix\.run\/remix-run\/ui\/accordion/)
  })

  it('leads with spring usage and keeps timing details in the reference', async () => {
    let response = await router.fetch(new Request('http://localhost/animation/spring/'))
    let html = await response.text()
    assert.equal(response.status, 200)
    assert.doesNotMatch(html, /<h[23]>Compare the presets<\/h[23]>/)
    assert.ok(html.indexOf('id="billing"') < html.indexOf('id="anatomy"'))
    assert.ok(html.indexOf('id="custom"') < html.indexOf('id="api-reference"'))
    assert.match(html, /aria-label="Billing period"/)
    assert.match(html, /id="spring-reference"/)
    assert.match(html, /id="transition-reference"/)
    assert.match(html, /id="custom"/)
    assert.match(html, /id="web-animations-example"/)
    assert.match(html, /id="iterator-example"/)
    assert.doesNotMatch(html, /id="reduced-motion-reference"/)
    assert.match(html, /Animate/)
    assert.doesNotMatch(html, /Reset/)
    assert.match(html, /prefers-reduced-motion/)
    assert.match(html, /presets\.example[^"<]*\.tsx/)
    assert.match(html, /data-demo-source/)
    assert.doesNotMatch(html, /<details/)
  })

  it('leads with a notification example before explaining entrance and exit', async () => {
    let response = await router.fetch(new Request('http://localhost/animation/entrance-exit/'))
    let html = await response.text()
    assert.equal(response.status, 200)
    assert.ok(html.indexOf('id="presence"') < html.indexOf('id="anatomy"'))
    assert.match(html, /id="entrance-reference"/)
    assert.match(html, /id="exit-reference"/)
    assert.match(html, /Hide notification/)
    assert.match(html, /data-demo-source/)
  })

  it('demonstrates layout changes and documents position-only configuration', async () => {
    let response = await router.fetch(new Request('http://localhost/animation/layout/'))
    let html = await response.text()
    assert.equal(response.status, 200)
    assert.ok(html.indexOf('id="reordering"') < html.indexOf('id="anatomy"'))
    assert.match(html, /id="reordering"/)
    assert.match(html, /id="selection"/)
    assert.match(html, /id="layout-reference"/)
    assert.match(html, /aria-label="Sort tasks"/)
    assert.doesNotMatch(html, /Change layout|Reverse order|Animate size changes/)
    assert.match(html, /size: false/)
  })

  it('demonstrates tween timing and explains applying its final returned value', async () => {
    let response = await router.fetch(new Request('http://localhost/animation/tween/'))
    let html = await response.text()
    assert.equal(response.status, 200)
    assert.ok(html.indexOf('id="timing"') < html.indexOf('id="anatomy"'))
    assert.match(html, /aria-label="Revenue period"/)
    assert.match(html, /id="tween-reference"/)
    assert.match(html, /done: true/)
    assert.match(html, /requestAnimationFrame/)
  })

  it('documents reduced motion on its own animation page', async () => {
    let response = await router.fetch(new Request('http://localhost/animation/reduced-motion/'))
    let html = await response.text()
    assert.equal(response.status, 200)
    assert.match(html, /<h1[^>]*>Reduced motion<\/h1>/)
    assert.match(html, /href="\/animation\/reduced-motion\/" aria-current="page"/)
    assert.match(html, /id="css-transitions"/)
    assert.match(html, /id="javascript-playback"/)
    assert.match(html, /id="animation-mixins"/)
    assert.match(html, /id="prefers-reduced-motion-reference"/)
    assert.match(html, /prefersReducedMotion\(\)/)
    assert.match(html, /server rendering/)
    assert.match(html, /does not subscribe to changes/)
    assert.match(html, /data-code-block-copy/)
  })

  it('returns a useful 404 for an unknown page or category', async () => {
    let [missing, wrongCategory] = await Promise.all([
      router.fetch(new Request('http://localhost/patterns/missing/')),
      router.fetch(new Request('http://localhost/system/accordion/')),
    ])
    assert.equal(missing.status, 404)
    assert.equal(wrongCategory.status, 404)
    let html = await missing.text()
    assert.match(html, /Get started with Remix UI/)
    assert.doesNotMatch(html, /On this page|href="#installation"|href="#using-ui"|href="#explore"/)
  })

  it('renders every pattern with a hero, visible source and a complete reference', async () => {
    for (let page of pages.filter((page) => page.category === 'patterns')) {
      let response = await router.fetch(new Request(`http://localhost/patterns/${page.slug}/`))
      let html = await response.text()
      assert.equal(response.status, 200)
      assert.match(html, /data-demo-source/)
      assert.ok(html.indexOf('data-demo-source') < html.indexOf('id="anatomy"'))
      assert.ok(html.indexOf('id="accessibility"') < html.indexOf('id="api-reference"'))
      assert.match(html, /<table>/)
      assert.match(
        html,
        new RegExp(`${page.slug === 'anchor' ? 'chart' : 'basic'}\\.example[^"<]*\\.tsx`),
      )
      assert.match(html, new RegExp(`href="/patterns/${page.slug}/" aria-current="page"`))
    }
  })

  it('serves example modules but keeps page components and controllers private', async () => {
    let [example, page, controller] = await Promise.all([
      router.fetch(new Request('http://localhost/assets/app/examples/accordion/basic.example.tsx')),
      router.fetch(new Request('http://localhost/assets/app/pages/patterns/accordion.tsx')),
      router.fetch(new Request('http://localhost/assets/app/actions/docs/controller.tsx')),
    ])
    assert.equal(example.status, 200)
    assert.match(await example.text(), /export/)
    assert.equal(page.status, 404)
    assert.equal(controller.status, 404)
  })
})
