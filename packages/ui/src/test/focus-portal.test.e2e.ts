import * as path from 'node:path'
import { expect } from '@remix-run/assert'
import { createAssetServer } from '@remix-run/assets'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import { describe, it, type TestContext } from '@remix-run/test'

async function openFixture(t: TestContext, route = '/scoped?scenario=form') {
  let assets = createAssetServer({
    rootDir: path.resolve(import.meta.dirname, '../..'),
    basePath: '/assets',
    mounts: { packages: '..', npm: '../../node_modules' },
    allowFiles: ['src/**'],
    allowPackages: ['@remix-run/component', '@remix-run/data-schema', 'tabbable'],
    watch: false,
  })
  t.after(() => assets.close())
  let entry = await assets.getScriptEntry(
    path.join(import.meta.dirname, 'focus-portal.fixture.tsx'),
  )
  let page = await t.serve(
    await createTestServer(async (request) => {
      let assetResponse = await assets.fetch(request)
      if (assetResponse) return assetResponse
      return new Response(
        `<!doctype html><html><head><style>
      .fields { display:grid; gap:12px; max-width:360px } label { display:grid }
      .popup { background:white; border:1px solid black; padding:16px }
      .dialog { inset:5% 20%; max-height:85vh; overflow:auto; padding:24px; background:white }
      .backdrop { position:fixed; inset:0; background:#0005 }
      .notifications { position:fixed; right:16px; bottom:16px; z-index:1000; background:white; padding:12px }
    </style><script type="importmap">${JSON.stringify(entry.importMap)}</script></head>
    <body><script type="module" src="${entry.href}"></script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } },
      )
    }),
  )
  await page.goto(route)
  return page
}

describe('Portal focus navigation', () => {
  it('leaves plain Portal content at its physical document position', async (t) => {
    let page = await openFixture(t, '/plain?scenario=form')
    await page.locator('#form-popup-trigger').click()
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#form-after-popup').evaluate((node) => node === document.activeElement),
    ).toBe(true)
  })

  it('enters a scoped popover at its origin and returns in both directions', async (t) => {
    let page = await openFixture(t)
    await page.locator('#form-popup-trigger').click()
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#form-popup-first').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.locator('#form-popup-last').focus()
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#form-after-popup').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.keyboard.press('Shift+Tab')
    expect(
      await page.locator('#form-popup-last').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.locator('#form-popup-first').focus()
    await page.keyboard.press('Shift+Tab')
    expect(
      await page.locator('#form-popup-trigger').evaluate((node) => node === document.activeElement),
    ).toBe(true)
  })

  it('keeps inline popover content in native document order', async (t) => {
    let page = await openFixture(t, '/scoped?render=inline&scenario=form')
    await page.locator('#form-popup-trigger').click()
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#form-popup-first').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.locator('#form-popup-last').focus()
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#form-after-popup').evaluate((node) => node === document.activeElement),
    ).toBe(true)
  })

  it('uses the Portal declaration when a field separates it from the trigger', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=form&separated')
    await page.locator('#form-popup-trigger').click()
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#form-popup-between').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#form-popup-first').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.locator('#form-popup-last').focus()
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#form-after-popup').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.locator('#form-popup-first').focus()
    await page.keyboard.press('Shift+Tab')
    expect(
      await page.locator('#form-popup-between').evaluate((node) => node === document.activeElement),
    ).toBe(true)
  })

  it('closes a menu on Tab and continues after its owning trigger', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=modal')
    await page.locator('#modal-trigger').click()
    await page.locator('#modal-menu-trigger').click()
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#modal-after-menu').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.locator('#modal-menu-surface[data-open]').waitFor({ state: 'hidden' })
  })

  it('continues from an inline root when its portaled submenu closes on Tab', async (t) => {
    let page = await openFixture(t, '/scoped?render=inline&scenario=form&submenu=portaled')
    await page.locator('#form-menu-trigger').press('Enter')
    await page.locator('#form-menu-sub-trigger').press('ArrowRight')
    await page.locator('#form-menu-sub-list [role="menuitem"]:focus').waitFor()
    await page.keyboard.press('Tab')
    await page.locator('#form-menu-surface[data-open]').waitFor({ state: 'hidden' })
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('form-after-menu')
    await page.goto('/scoped?render=inline&scenario=form&submenu=portaled')
    await page.locator('#form-menu-trigger').press('Enter')
    await page.locator('#form-menu-sub-trigger').press('ArrowRight')
    await page.locator('#form-menu-sub-list [role="menuitem"]:focus').waitFor()
    await page.keyboard.press('Shift+Tab')
    await page.locator('#form-menu-surface[data-open]').waitFor({ state: 'hidden' })
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('form-menu-trigger')
  })

  it('exits a portaled select without restoring focus over its continuation', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=modal')
    await page.locator('#modal-trigger').click()
    await page.locator('#modal-select-trigger').click()
    await page.keyboard.press('Tab')
    await page.locator('#modal-select-surface[data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('#modal-after-select').evaluate((node) => node === document.activeElement),
    ).toBe(true)
  })
  it('exits an inline select and preserves forward and reverse navigation', async (t) => {
    let page = await openFixture(t, '/scoped?render=inline&scenario=form')
    await page.locator('#form-select-trigger').click()
    await page.keyboard.press('Tab')
    await page.locator('#form-select-surface[data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('#form-after-select').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.locator('#form-select-trigger').click()
    await page.keyboard.press('Shift+Tab')
    await page.locator('#form-select-surface[data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.evaluate(() => {
        let active = document.activeElement
        return active?.id === 'form-select-trigger' || active?.id === 'form-after-menu'
      }),
    ).toBe(true)
  })

  it('keeps combobox navigation on the input and Tab in the form', async (t) => {
    let page = await openFixture(t)
    await page.locator('#form-combo-input').fill('Option')
    await page.locator('#form-combo-input').press('ArrowDown')
    expect(
      await page.locator('#form-combo-input').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#form-after-combo').evaluate((node) => node === document.activeElement),
    ).toBe(true)
  })

  it('places a non-modal dialog at its declaration and continues into the page', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=non-modal')
    await page.locator('#modal-trigger').press('Enter')
    await page.locator('#modal-surface').waitFor({ state: 'visible' })
    let snapshot = await page.locator('body').ariaSnapshot()
    expect(snapshot.split('dialog "Dialog"').length - 1).toBe(1)
    expect(snapshot.indexOf('dialog "Dialog"') < snapshot.indexOf('textbox "Outside after"')).toBe(
      true,
    )
    await page.locator('#modal-close').press('Tab')
    expect(
      await page.locator('#outside-after').evaluate((node) => node === document.activeElement),
    ).toBe(true)
  })

  it('returns from a portaled popover to the following dialog field', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=modal')
    await page.locator('#modal-trigger').click()
    await page.locator('#modal-popup-trigger').click()
    await page.locator('#modal-popup-last').focus()
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#modal-after-popup').evaluate((node) => node === document.activeElement),
    ).toBe(true)
  })

  it('continues from an inline menu with a portaled submenu inside a modal', async (t) => {
    let page = await openFixture(t, '/scoped?render=inline&scenario=modal&submenu=portaled')
    await page.locator('#modal-trigger').press('Enter')
    await page.locator('#modal-menu-trigger').press('Enter')
    await page.locator('#modal-menu-sub-trigger').press('ArrowRight')
    await page.locator('#modal-menu-sub-list [role="menuitem"]:focus').waitFor()
    await page.keyboard.press('Tab')
    await page.locator('#modal-menu-surface[data-open]').waitFor({ state: 'hidden' })
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('modal-after-menu')
    expect(await page.evaluate(() => !!document.activeElement?.closest('#modal-surface'))).toBe(
      true,
    )
    await page.goto('/scoped?render=inline&scenario=modal&submenu=portaled')
    await page.locator('#modal-trigger').press('Enter')
    await page.locator('#modal-menu-trigger').press('Enter')
    await page.locator('#modal-menu-sub-trigger').press('ArrowRight')
    await page.locator('#modal-menu-sub-list [role="menuitem"]:focus').waitFor()
    await page.keyboard.press('Shift+Tab')
    await page.locator('#modal-menu-surface[data-open]').waitFor({ state: 'hidden' })
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('modal-menu-trigger')
  })
  it('continues after an inline select inside a modal dialog', async (t) => {
    let page = await openFixture(t, '/scoped?render=inline&scenario=modal')
    await page.locator('#modal-trigger').click()
    await page.locator('#modal-select-trigger').click()
    await page.keyboard.press('Tab')
    await page.locator('#modal-select-surface[data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('#modal-after-select').evaluate((node) => node === document.activeElement),
    ).toBe(true)
  })

  it('contains an inline nested modal inside a portaled parent', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=modal')
    await page.locator('#modal-trigger').click()
    await page.locator('#modal-child-trigger').click()
    await page.locator('#modal-child-close').focus()
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() => !!document.activeElement?.closest('#modal-child-surface')),
    ).toBe(true)
    await page.keyboard.press('Escape')
    expect(
      await page
        .locator('#modal-child-trigger')
        .evaluate((node) => node === document.activeElement),
    ).toBe(true)
  })

  it('returns from a nested portal without suppressing its parent controls', async (t) => {
    let page = await openFixture(t)
    await page.locator('#form-popup-trigger').click()
    await page.locator('#form-popup-child-trigger').click()
    await page.locator('#form-popup-child-last').focus()
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#form-popup-last').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.keyboard.press('Shift+Tab')
    expect(
      await page
        .locator('#form-popup-child-last')
        .evaluate((node) => node === document.activeElement),
    ).toBe(true)
  })

  it('restores the toast origin after native keyboard entry and dismissal', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=toast')
    let tab = page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab'
    await page.locator('#toast-origin').press('Enter')
    await page.keyboard.press(tab)
    await page.keyboard.press(tab)
    await page.locator('#toast-action:focus').waitFor()
    await page.keyboard.press('Enter')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('toast-origin')
  })

  it('restores the following control after backward native keyboard entry and dismissal', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=toast')
    let tab =
      page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab'
    await page.locator('#toast-origin').press('Enter')
    await page.locator('#toast-after').focus()
    await page.keyboard.press(tab)
    await page.locator('#toast-action:focus').waitFor()
    await page.keyboard.press('Enter')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('toast-after')
  })

  it('does not establish a toast return target from pointer entry', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=toast')
    await page.locator('#toast-origin').click()
    await page.locator('#toast-action').click()
    expect(
      await page.locator('#toast-origin').evaluate((node) => node === document.activeElement),
    ).toBe(false)
    expect(
      await page
        .locator('#notifications')
        .evaluate((node) => node.contains(document.activeElement)),
    ).toBe(false)
  })

  it('keeps toast focus when its action dismisses a popup and returns to the popup trigger', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=toast-dialog')
    await page.locator('#notification-dialog-trigger').press('Enter')
    await page.locator('#notification-publish').press('Enter')
    await page.locator('#notification-popup-trigger').press('Enter')
    await page.locator('#notification-popup-first').focus()
    await page.keyboard.press('F6')
    await page.locator('#notification-region:focus').waitFor()
    await page.locator('#notification-action').press('Enter')
    await page.locator('#notification-popup-surface[data-open]').waitFor({ state: 'hidden' })
    expect(await page.locator('#notification-dialog').getAttribute('data-state')).toBe('open')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('notification-action')
    await page.keyboard.press('F6')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('notification-popup-trigger')
  })
  it('returns to the dialog opener after a toast action closes its popup and owner', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=toast-dialog')
    await page.locator('#notification-dialog-trigger').press('Enter')
    await page.locator('#notification-publish').press('Enter')
    await page.locator('#notification-popup-trigger').press('Enter')
    await page.locator('#notification-popup-first').focus()
    await page.keyboard.press('F6')
    await page.locator('#notification-region:focus').waitFor()
    await page.locator('#notification-close-owner').press('Enter')
    await page.locator('#notification-dialog[data-open]').waitFor({ state: 'hidden' })
    await page.locator('#notification-popup-surface[data-open]').waitFor({ state: 'hidden' })
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('notification-close-owner')
    await page.keyboard.press('F6')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe(
      'notification-dialog-trigger',
    )
  })

  it('keeps modal guards active through closing motion and reopening', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=modal')
    await page.locator('#modal-trigger').press('Enter')
    await page.locator('#modal-surface').evaluate((node) => {
      node.style.transition = 'opacity 2s'
      node.style.opacity = '1'
      let style = document.createElement('style')
      style.textContent = '#modal-surface[data-state="closed"] { opacity:0 !important }'
      document.head.append(style)
    })
    await page.locator('#modal-close').press('Enter')
    await page.locator('#modal-surface[data-state="closed"][data-open]').waitFor()
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('#modal-surface'))).toBe(
      true,
    )
    expect(await page.locator('#outside-after').evaluate((node) => !!node.closest('[inert]'))).toBe(
      true,
    )
    await page.locator('#modal-trigger').dispatchEvent('click')
    await page.locator('#modal-surface[data-state="open"]').waitFor()
    await page.locator('#modal-close').press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('#modal-surface'))).toBe(
      true,
    )
  })

  it('keeps a nested modal trapped until exit completes and returns to its parent', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=modal&nested=portaled')
    await page.locator('#modal-trigger').press('Enter')
    await page.locator('#modal-child-trigger').press('Enter')
    await page.locator('#modal-child-surface').evaluate((node) => {
      node.style.transition = 'opacity 0.3s'
      node.style.opacity = '1'
      let style = document.createElement('style')
      style.textContent = '#modal-child-surface[data-state="closed"] { opacity:0 !important }'
      document.head.append(style)
      node.addEventListener(
        'transitionrun',
        () => {
          for (let animation of node.getAnimations()) animation.pause()
        },
        { once: true },
      )
    })
    await page.locator('#modal-child-close').press('Enter')
    await page.locator('#modal-child-surface[data-state="closed"][data-open]').waitFor()
    await page.waitForFunction(() =>
      document
        .querySelector('#modal-child-surface')
        ?.getAnimations()
        .some((animation) => animation.playState === 'paused'),
    )
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() => !!document.activeElement?.closest('#modal-child-surface')),
    ).toBe(true)
    await page.locator('#modal-child-surface').evaluate((node) => {
      for (let animation of node.getAnimations()) animation.finish()
    })
    await page.locator('#modal-child-surface[data-open]').waitFor({ state: 'hidden' })
    await page.locator('#modal-child-trigger:focus').waitFor()
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('#modal-surface'))).toBe(
      true,
    )
  })

  it('does not revisit unchecked radios at the physical destination', async (t) => {
    let page = await openFixture(t, '/scoped?scenario=form&radio')
    await page.locator('#form-popup-trigger').click()
    await page.locator('#form-after-combo').focus()
    expect(await page.locator('#radio-one').getAttribute('tabindex')).toBe('-1')
    expect(await page.locator('#radio-two').getAttribute('tabindex')).toBe('-1')
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() => !!document.activeElement?.closest('#form-popup-surface')),
    ).toBe(false)
    await page.locator('#form-popup-trigger').focus()
    await page.keyboard.press('Tab')
    expect(await page.locator('#radio-one').getAttribute('tabindex')).toBe(null)
    expect(await page.locator('#radio-two').getAttribute('tabindex')).toBe(null)
  })

  it('restores native navigation when focus enters shadow controls inside the popup', async (t) => {
    let page = await openFixture(t)
    await page.locator('#form-popup-trigger').click()
    await page.locator('#form-popup-surface').evaluate((node) => {
      let host = document.createElement('div')
      host.id = 'shadow-controls'
      let shadow = host.attachShadow({ mode: 'open' })
      shadow.innerHTML = '<input id="shadow-first"><input id="shadow-last">'
      node.append(host)
    })
    await page.locator('#shadow-first').focus()
    expect(await page.locator('#shadow-last').getAttribute('tabindex')).toBe(null)
    await page.keyboard.press('Tab')
    expect(
      await page.locator('#shadow-last').evaluate((node) =>
        (() => {
          let root = node.getRootNode()
          return root instanceof ShadowRoot && root.activeElement === node
        })(),
      ),
    ).toBe(true)
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('form-after-popup')
  })

  it('keeps dynamically changed controls out of the physical destination Tab order', async (t) => {
    let page = await openFixture(t)
    await page.locator('#form-popup-trigger').click()
    await page.locator('#form-after-popup').focus()
    await page.locator('#form-popup-surface').evaluate((node) => {
      let input = document.createElement('input')
      input.id = 'dynamic-input'
      let disabled = document.createElement('button')
      disabled.id = 'dynamic-disabled'
      disabled.disabled = true
      let hidden = document.createElement('input')
      hidden.id = 'dynamic-hidden'
      hidden.hidden = true
      let link = document.createElement('a')
      link.id = 'dynamic-link'
      node.append(input, disabled, hidden, link)
    })
    await page.locator('#dynamic-input[tabindex="-1"]').waitFor({ state: 'attached' })
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('#dynamic-disabled')!.disabled = false
      document.querySelector<HTMLInputElement>('#dynamic-hidden')!.hidden = false
      document.querySelector<HTMLAnchorElement>('#dynamic-link')!.href = '#target'
    })
    await page.locator('#dynamic-disabled[tabindex="-1"]').waitFor({ state: 'attached' })
    await page.locator('#dynamic-hidden[tabindex="-1"]').waitFor({ state: 'attached' })
    await page.locator('#dynamic-link[tabindex="-1"]').waitFor({ state: 'attached' })
    await page.locator('#dynamic-link').evaluate((node) => node.setAttribute('tabindex', '0'))
    await page.locator('#dynamic-link[tabindex="-1"]').waitFor({ state: 'attached' })
    await page.locator('#form-after-combo').press('Tab')
    expect(
      await page.evaluate(() => !!document.activeElement?.closest('#form-popup-surface')),
    ).toBe(false)
    await page.locator('#form-popup-first').focus()
    expect(await page.locator('#dynamic-input').getAttribute('tabindex')).toBe(null)
    expect(await page.locator('#dynamic-disabled').getAttribute('tabindex')).toBe(null)
    expect(await page.locator('#dynamic-hidden').getAttribute('tabindex')).toBe(null)
    expect(await page.locator('#dynamic-link').getAttribute('tabindex')).toBe('0')
    await page.locator('#form-after-popup').focus()
    let restored = await page.locator('#dynamic-link').evaluate(async (node) => {
      node.remove()
      await new Promise<void>((resolve) => queueMicrotask(resolve))
      return node.getAttribute('tabindex')
    })
    expect(restored).toBe('0')
  })

  it('places non-modal popup content once at its origin in the accessibility tree', async (t) => {
    let page = await openFixture(t)
    await page.locator('#form-popup-trigger').click()
    await page.locator('[aria-owns]').waitFor()
    let snapshot = await page.locator('body').ariaSnapshot()
    if (page.context().browser()?.browserType().name() === 'chromium') {
      let session = await page.context().newCDPSession(page)
      try {
        let { nodes } = await session.send('Accessibility.getFullAXTree')
        let byId = new Map(nodes.map((node) => [node.nodeId, node]))
        let textboxes: string[] = []
        function visit(id: string) {
          let node = byId.get(id)
          if (!node) return
          if (!node.ignored && node.role?.value === 'textbox')
            textboxes.push(node.name?.value ?? '')
          for (let child of node.childIds ?? []) visit(child)
        }
        visit(nodes[0].nodeId)
        expect(textboxes.filter((name) => name === 'First').length).toBe(1)
        expect(textboxes.indexOf('First') < textboxes.indexOf('After popover')).toBe(true)
      } finally {
        await session.detach()
      }
    }
    expect(snapshot.split('textbox "First"').length - 1).toBe(1)
    expect(snapshot.indexOf('textbox "First"') < snapshot.indexOf('textbox "After popover"')).toBe(
      true,
    )
    await page.locator('#form-popup-child-trigger').click()
    expect(await page.locator('[aria-owns]').count()).toBe(2)
    expect(
      await page.locator('[aria-owns]').evaluateAll((nodes) => {
        let targets = nodes.map((node) => document.getElementById(node.getAttribute('aria-owns')!))
        return targets.every((target) => !!target) && new Set(targets).size === 2
      }),
    ).toBe(true)
    snapshot = await page.locator('body').ariaSnapshot()
    expect(snapshot.split('textbox "First"').length - 1).toBe(2)
  })

  it('gives a submenu accessibility owner the group role inside its parent menu', async (t) => {
    let page = await openFixture(t)
    await page.locator('#form-menu-trigger').click()
    await page.locator('#form-menu-sub-trigger').press('ArrowRight')
    await page.locator('#form-menu-sub-list').waitFor({ state: 'visible' })
    expect(await page.locator('#form-menu-list [aria-owns]').getAttribute('role')).toBe('group')
    let snapshot = await page.locator('body').ariaSnapshot()
    expect(snapshot.split('menuitem "Action B"').length - 1).toBe(1)
  })
})
