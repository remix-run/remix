import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { anchor } from './anchor.ts'

describe('anchor in the browser', () => {
  it('keeps a fixed surface aligned inside a positioned ancestor while the page scrolls', async (t) => {
    let originalStyle = document.body.getAttribute('style')
    let originalScroll = { left: window.scrollX, top: window.scrollY }
    let style = document.createElement('style')
    style.textContent = '.anchor-test-floating { position: fixed; width: 120px; height: 80px; }'
    let container = document.createElement('div')
    container.style.cssText = 'position: relative; margin: 400px 0 0 300px;'
    let target = document.createElement('div')
    target.style.cssText = 'width: 80px; height: 28px;'
    let floating = document.createElement('div')
    floating.className = 'anchor-test-floating'
    container.append(target, floating)
    document.body.style.cssText = 'margin: 0; width: 2000px; height: 2000px;'
    document.head.append(style)
    document.body.append(container)
    let cleanup = () => {}
    t.after(() => {
      cleanup()
      container.remove()
      style.remove()
      if (originalStyle === null) document.body.removeAttribute('style')
      else document.body.setAttribute('style', originalStyle)
      window.scrollTo(originalScroll)
    })

    window.scrollTo(100, 200)
    await t.waitFor(() => {
      expect(window.scrollX).toBe(100)
      expect(window.scrollY).toBe(200)
    })
    cleanup = anchor(floating, target, { placement: 'bottom-start' })

    expect(floating.getBoundingClientRect().left).toBe(target.getBoundingClientRect().left)
    expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)
    expect(getComputedStyle(floating).position).toBe('fixed')

    window.scrollTo(150, 250)
    await t.waitFor(() => {
      expect(window.scrollX).toBe(150)
      expect(window.scrollY).toBe(250)
      expect(floating.getBoundingClientRect().left).toBe(target.getBoundingClientRect().left)
      expect(floating.getBoundingClientRect().top).toBe(target.getBoundingClientRect().bottom)
    })

    cleanup()
    cleanup = anchor(floating, target, { placement: 'bottom-start' })
    expect(floating.getBoundingClientRect().left).toBe(150)
    expect(floating.getBoundingClientRect().top).toBe(178)
    expect(getComputedStyle(floating).position).toBe('fixed')
  })
})
