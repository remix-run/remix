import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { measureUntransformed, measureUntransformedBatch } from './animation-host.ts'
import { readUntransformedRect } from './layout-measurement.ts'

function browserBox(node: HTMLElement) {
  let properties = ['transform', 'translate', 'rotate', 'scale']
  let saved = node.style.cssText
  try {
    for (let property of properties) node.style.setProperty(property, 'none', 'important')
    return node.getBoundingClientRect()
  } finally {
    node.style.cssText = saved
  }
}

function sameBox(actual: DOMRect, expected: DOMRect) {
  for (let property of ['left', 'top', 'width', 'height'] as const) {
    assert.ok(
      Math.abs(actual[property] - expected[property]) < 0.05,
      `${property}: ${actual[property]} should equal ${expected[property]}`,
    )
  }
}

function fixture(t: { after(callback: () => void): void }) {
  let parent = document.createElement('div')
  let node = document.createElement('div')
  parent.style.cssText = 'position:fixed;left:120px;top:100px;width:320px;height:240px;'
  node.style.cssText = 'width:80.25px;height:60.75px;'
  parent.append(node)
  document.body.append(parent)
  t.after(() => parent.remove())
  return { parent, node }
}

describe('Layout measurement', () => {
  it('recovers fractional boxes under combined transforms without changing styles', (t) => {
    let { parent, node } = fixture(t)
    parent.style.transform = 'rotate(17deg) scale(1.2, .8)'
    node.style.cssText +=
      'padding:3.5px;border:1.25px solid;transform:translate(11px, -8px) rotate(23deg) scale(.75,1.3);translate:12% -7%;rotate:11deg;scale:1.1 .9;transform-origin:20% 75%;'
    let expected = browserBox(node)
    let mutations = new MutationObserver(() => {})
    mutations.observe(node, { attributes: true })
    t.after(() => mutations.disconnect())
    let actual = readUntransformedRect(node)
    assert.ok(actual)
    sameBox(actual, expected)
    assert.equal(mutations.takeRecords().length, 0)
  })

  it('reads paused native animation values rather than their inline endpoints', (t) => {
    let { parent, node } = fixture(t)
    parent.style.rotate = '-.05turn'
    node.style.boxSizing = 'border-box'
    node.style.border = '2px solid'
    let animation = node.animate(
      [
        { translate: '0px 0px', transform: 'scale(1)' },
        { translate: '80px 40px', transform: 'scale(.6, 1.4)' },
      ],
      { duration: 1000, fill: 'both' },
    )
    t.after(() => animation.cancel())
    animation.pause()
    animation.currentTime = 400
    let actual = readUntransformedRect(node)
    assert.ok(actual)
    // The untransformed result must match the same box without playback.
    animation.cancel()
    sameBox(actual, browserBox(node))
  })

  it('uses the browser fallback for perspective and unresolved lengths', (t) => {
    let { parent, node } = fixture(t)
    parent.style.perspective = '600px'
    node.style.transform = 'rotateY(30deg)'
    assert.equal(readUntransformedRect(node), undefined)
    sameBox(measureUntransformed(node), browserBox(node))
    parent.style.perspective = ''
    node.style.transform = ''
    node.style.translate = 'calc(10% + 4px) 0'
    assert.equal(readUntransformedRect(node), undefined)
    sameBox(measureUntransformed(node), browserBox(node))
  })

  it('reads independent boxes together and applies ancestor writes before descendants', (t) => {
    let { parent, node } = fixture(t)
    let sibling = document.createElement('div')
    sibling.style.cssText = 'width:40px;height:40px;transform:translateX(20px)'
    parent.append(sibling)
    node.style.transform = 'translateX(30px)'
    let child = document.createElement('div')
    child.style.cssText = 'width:20px;height:20px;'
    node.append(child)
    let childLeft = 0
    let naturalLeft = node.getBoundingClientRect().left - 30
    measureUntransformedBatch([child, sibling, node], (target, rect) => {
      if (target === node || target === sibling) {
        assert.equal(node.style.transform, 'none')
        assert.equal(sibling.style.transform, 'none')
      }
      if (target === child) childLeft = rect.left
      return () => {
        if (target === node) node.style.transform = 'translateX(50px)'
      }
    })
    assert.ok(Math.abs(childLeft - naturalLeft - 50) < 0.05)
  })

  it('restores temporary styles if a measurement throws', (t) => {
    let { parent, node } = fixture(t)
    parent.style.transform = 'rotate(10deg)'
    node.style.setProperty('translate', '12px', 'important')
    let original = node.style.cssText
    assert.throws(
      () =>
        measureUntransformedBatch([node], () => {
          throw new Error('measurement failed')
        }),
      /measurement failed/,
    )
    assert.equal(node.style.cssText, original)
  })
})
