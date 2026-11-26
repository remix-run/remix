import * as path from 'node:path'
import { expect } from '@remix-run/assert'
import { createAssetServer } from '@remix-run/assets'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import { describe, it, type TestContext } from '@remix-run/test'

async function openFixture(
  t: TestContext,
  options: {
    modal?: boolean | 'trap-focus'
    confirm?: boolean
    detached?: boolean
    native?: boolean
    bare?: boolean
    open?: boolean
  } = {},
) {
  let assets = createAssetServer({
    rootDir: path.resolve(import.meta.dirname, '../..'),
    basePath: '/assets',
    mounts: { packages: '..', npm: '../../node_modules' },
    allowFiles: ['src/**'],
    allowPackages: ['@remix-run/component', '@remix-run/data-schema', 'tabbable'],
    watch: false,
  })
  t.after(() => assets.close())
  let entry = await assets.getScriptEntry(path.join(import.meta.dirname, 'dialog.fixture.tsx'))
  let page = await t.serve(
    await createTestServer(async (request) => {
      let assetResponse = await assets.fetch(request)
      if (assetResponse) return assetResponse
      return new Response(
        `<!doctype html><html><head><style>
      [role="dialog"] { inset: 0; margin: auto; height: max-content; background: white; width: min(28rem, calc(100vw - 4rem)); max-height: calc(100dvh - 4rem); overflow: auto; padding: 1rem; }
      [data-testid$="backdrop"] { position: fixed; inset: 0; margin: 0; width: auto; height: auto; border: 0; background: #0008; }
      [data-popover] { background: white; border: 1px solid black; padding: 8px; }
      button, input { margin: .25rem; }
    </style><script type="importmap">${JSON.stringify(entry.importMap)}</script></head>
    <body><script type="module" src="${entry.href}"></script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } },
      )
    }),
  )
  let params = new URLSearchParams()
  if (options.modal === false) params.set('modal', 'false')
  if (options.modal === 'trap-focus') params.set('modal', 'trap-focus')
  if (options.native) params.set('native', 'true')
  if (options.bare) params.set('bare', 'true')
  if (options.confirm) params.set('confirm', 'true')
  if (options.detached) params.set('detached', 'true')
  await page.goto(`/?${params}`)
  if (options.open !== false) {
    await page.locator('#trigger').click()
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
  }
  return page
}

describe('dialog browser interactions', () => {
  it('contains keyboard focus and restores focus after a real Escape press', async (t) => {
    let page = await openFixture(t)
    expect(await page.locator('#name').evaluate((node) => node === document.activeElement)).toBe(
      true,
    )
    await page.locator('#outside').evaluate((node) => node.focus())
    expect(await page.locator('#outside').evaluate((node) => node === document.activeElement)).toBe(
      false,
    )
    await page.locator('#name').focus()
    await page.keyboard.press('Shift+Tab')
    expect(await page.locator('#outside').evaluate((node) => node === document.activeElement)).toBe(
      false,
    )
    await page.keyboard.press('Tab')
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
    expect(await page.locator('#trigger').evaluate((node) => node === document.activeElement)).toBe(
      true,
    )
  })

  it('preserves native interior Tab navigation while keeping the modal boundary', async (t) => {
    let page = await openFixture(t, { native: true, open: false })
    await page.locator('#native-start').focus()
    await page.keyboard.press('Tab')
    let nativeTarget = await page.evaluate(() =>
      document.activeElement?.id.replace('native-', 'scope-'),
    )
    await page.locator('#trigger').click()
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
    await page.locator('#scope-start').focus()
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe(nativeTarget)
    await page.locator('#scope-end').focus()
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('scope-start')
    expect(await page.evaluate(() => document.hasFocus())).toBe(true)
  })
  it('lets native Tab reach guards from either end instead of intercepting calculated endpoints', async (t) => {
    let page = await openFixture(t, { bare: true })
    await page.evaluate(() => {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
          document.body.dataset.tabPrevented = String(event.defaultPrevented)
        }
      })
      document.addEventListener(
        'focus',
        (event) => {
          if (
            event.target instanceof HTMLElement &&
            event.target.hasAttribute('data-rmx-focus-guard')
          ) {
            document.body.dataset.guardReached = 'true'
          }
        },
        true,
      )
    })
    await page.locator('#scope-end').focus()
    await page.keyboard.press('Tab')
    expect(await page.locator('body').getAttribute('data-tab-prevented')).toBe('false')
    expect(await page.locator('body').getAttribute('data-guard-reached')).toBe('true')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('scope-start')
    await page.locator('body').evaluate((node) => delete node.dataset.guardReached)
    await page.keyboard.press('Shift+Tab')
    expect(await page.locator('body').getAttribute('data-tab-prevented')).toBe('false')
    expect(await page.locator('body').getAttribute('data-guard-reached')).toBe('true')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('scope-end')
    expect(await page.evaluate(() => document.hasFocus())).toBe(true)
  })

  it('contains Tab when native navigation skips the final buttons', async (t) => {
    let page = await openFixture(t, { bare: true })
    await page.locator('#scope-middle').focus()
    await page.keyboard.press('Tab')
    expect(
      await page
        .locator('[data-testid="dialog"]')
        .evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true)
    expect(await page.evaluate(() => document.hasFocus())).toBe(true)
    await page.keyboard.press('Tab')
    expect(
      await page
        .locator('[data-testid="dialog"]')
        .evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true)
    expect(await page.evaluate(() => document.hasFocus())).toBe(true)
  })

  it('escapes transformed clipping ancestors through ordinary DOM portals', async (t) => {
    let page = await openFixture(t)
    await page.locator('#app').evaluate((node) => {
      node.style.cssText =
        'transform: translate(20px, 20px); overflow: hidden; width: 40px; height: 40px; isolation: isolate'
    })
    expect(await page.locator(':popover-open').count()).toBe(0)
    expect(await page.locator('[popover]').count()).toBe(0)
    expect(await page.locator('#app [role="dialog"]').count()).toBe(0)
    await page.locator('#name').fill('Portal content')
    await page.locator('#popover-trigger').click()
    await page.locator('#popup-action').click()
    await page.keyboard.press('Escape')
    await page.locator('#close').click()
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('allows an ordinary higher-z-index widget to appear above a non-modal dialog', async (t) => {
    let page = await openFixture(t, { modal: false })
    await page.locator('[data-testid="dialog"]').evaluate((node) => {
      let rect = node.getBoundingClientRect()
      let widget = document.createElement('button')
      widget.id = 'foreign-widget'
      widget.textContent = 'External widget'
      widget.style.cssText = `position: fixed; z-index: 10000; left: ${rect.left}px; top: ${rect.top}px; width: 180px; height: 60px;`
      widget.addEventListener('click', () => {
        widget.textContent = 'Clicked'
      })
      document.body.append(widget)
    })
    await page.locator('#foreign-widget').click()
    expect(await page.locator('#foreign-widget').textContent()).toBe('Clicked')
  })

  it('places a child backdrop above its parent and below its own dialog', async (t) => {
    let page = await openFixture(t)
    await page.locator('#child-trigger').click()
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor()
    let order = await page.evaluate(() => {
      function z(testId: string) {
        let node = document.querySelector(`[data-testid="${testId}"]`)
        if (!node) throw new Error('Missing layer')
        return Number(getComputedStyle(node).zIndex)
      }
      return (
        z('backdrop') < z('dialog') &&
        z('dialog') < z('child-backdrop') &&
        z('child-backdrop') < z('child-dialog')
      )
    })
    expect(order).toBe(true)
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor({ state: 'hidden' })
    expect(await page.locator('[data-testid="dialog"][data-open]').count()).toBe(1)
    await page.locator('#name').fill('Still editing')
  })

  it('returns to the editor after a vetoed outside dismissal opens a confirmation', async (t) => {
    let page = await openFixture(t, { confirm: true })
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor()
    await page.locator('#child-close').click()
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    expect(await page.locator('#name').evaluate((node) => node === document.activeElement)).toBe(
      true,
    )
  })

  it('toggles a non-modal dialog closed with either trigger after pointer focus moves', async (t) => {
    let page = await openFixture(t, { modal: false })
    await page.locator('#trigger').click()
    await page
      .locator('[data-testid="dialog"][data-open]')
      .waitFor({ state: 'hidden', timeout: 2000 })
    await page.locator('#trigger').click()
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
    await page.locator('#second-trigger').click()
    await page
      .locator('[data-testid="dialog"][data-open]')
      .waitFor({ state: 'hidden', timeout: 2000 })
  })

  it('closes nested dialogs one at a time with Escape', async (t) => {
    let page = await openFixture(t)
    await page.locator('#child-trigger').click()
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    expect(
      await page.locator('#child-trigger').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('dismisses a popover before its containing dialog', async (t) => {
    let page = await openFixture(t)
    await page.locator('#popover-trigger').click()
    await page.locator('[data-testid="popover"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="popover"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('dismisses a menu before its containing dialog', async (t) => {
    let page = await openFixture(t)
    await page.locator('#menu-trigger').click()
    await page.locator('[data-testid="menu"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="menu"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('requires releasing Escape before dismissing the dialog after its menu', async (t) => {
    let page = await openFixture(t)
    await page.locator('#menu-trigger').click()
    await page.locator('[data-testid="menu"][data-open]').waitFor()
    await page.keyboard.down('Escape')
    await page.locator('[data-testid="menu"][data-open]').waitFor({ state: 'hidden' })
    await page.keyboard.down('Escape')
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.up('Escape')
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('wraps Tab from the last menu back to the first dialog control', async (t) => {
    let page = await openFixture(t)
    await page.locator('#menu-trigger').click()
    await page.locator('[data-testid="menu"][data-open]').waitFor()
    await page.keyboard.press('Tab')
    expect(await page.locator('#name').evaluate((node) => node === document.activeElement)).toBe(
      true,
    )
    await page.locator('[data-testid="menu"][data-open]').waitFor({ state: 'hidden' })
  })

  it('keeps a detached popup focusable and returns focus to its dialog anchor', async (t) => {
    let page = await openFixture(t, { detached: true })
    await page.locator('#popover-trigger').click()
    await page.locator('[data-testid="popover"][data-open]').waitFor()
    await page.locator('#popup-action:focus').waitFor()
    await page.locator('#popup-action').click()
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="popover"][data-open]').waitFor({ state: 'hidden' })
    await page.locator('#popover-trigger:focus').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('crosses detached popup boundaries without tabbing into the background', async (t) => {
    let page = await openFixture(t, { modal: 'trap-focus', detached: true })
    await page.locator('#popover-trigger').click()
    await page.locator('#popup-input').focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() => {
        let target = document.activeElement
        return !!target?.closest('[data-testid="dialog"], [data-testid="popover"]')
      }),
    ).toBe(true)
    expect(await page.evaluate(() => document.hasFocus())).toBe(true)
    await page.locator('#popup-input').focus()
    await page.keyboard.press('Shift+Tab')
    expect(
      await page.evaluate(() => !!document.activeElement?.closest('[data-testid="dialog"]')),
    ).toBe(true)
  })

  it('dismisses a select before its containing dialog', async (t) => {
    let page = await openFixture(t)
    await page.locator('#select-trigger').click()
    await page.locator('[data-testid="select"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="select"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('dismisses a combobox before its containing dialog', async (t) => {
    let page = await openFixture(t)
    await page.locator('#combobox-input').fill('Re')
    await page.locator('[data-testid="combobox"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="combobox"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('dismisses only the dropdown on the first backdrop click', async (t) => {
    let page = await openFixture(t)
    await page.locator('#select-trigger').click()
    await page.locator('[data-testid="select"][data-open]').waitFor()
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="select"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
    expect(await page.locator('#outside').textContent()).toBe('Outside 0')
  })

  it('ignores right clicks outside the dialog', async (t) => {
    let page = await openFixture(t)
    await page.mouse.click(2, 2, { button: 'right' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
  })

  it('ignores drags that start inside the dialog', async (t) => {
    let page = await openFixture(t)
    let rect = await page.locator('#name').boundingBox()
    if (!rect) throw new Error('Missing input geometry')
    await page.mouse.move(rect.x + 4, rect.y + 4)
    await page.mouse.down()
    await page.mouse.move(2, 2)
    await page.mouse.up()
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
    await page.locator('#trigger').click()
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('scrolls guard-directed focus into view in an overflowing dialog', async (t) => {
    let page = await openFixture(t, { native: true })
    await page.locator('[data-testid="dialog"]').evaluate((node) => {
      node.style.height = '120px'
      let last = node.querySelector<HTMLElement>('#scope-end')
      if (!last) throw new Error('Missing last control')
      last.style.cssText = 'display: block; margin-top: 600px'
    })
    await page.locator('#scope-start').focus()
    await page.keyboard.press('Shift+Tab')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('scope-end')
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }),
    )
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => {
        let last = node.querySelector('#scope-end')
        return (
          node.scrollTop > 0 &&
          !!last &&
          last.getBoundingClientRect().bottom <= node.getBoundingClientRect().bottom + 1
        )
      }),
    ).toBe(true)
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('scope-start')
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }),
    )
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => {
        let first = node.querySelector('#scope-start')
        return !!first && first.getBoundingClientRect().top >= node.getBoundingClientRect().top
      }),
    ).toBe(true)
  })
})
