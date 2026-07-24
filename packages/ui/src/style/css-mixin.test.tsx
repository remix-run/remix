import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRoot } from '../runtime/vdom.ts'
import { invariant } from '../runtime/invariant.ts'
import { createMixin } from '../runtime/mixins/mixin.ts'
import type { MixinBeforeRemoveEvent } from '../runtime/mixins/mixin.ts'
import { css } from './css-mixin.ts'
import type { CSSMixinDescriptor } from './css-mixin.ts'

describe('css mixin', () => {
  it('styles select elements', () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    let selectStyle: CSSMixinDescriptor = css({ color: 'red' })
    root.render(<select mix={[css({ backgroundColor: 'white' }), selectStyle]} />)
    root.flush()

    let select = container.querySelector('select')
    invariant(select)
    expect(select.className).toMatch(/rmxc-/)
  })

  it('concatenates generated classes with existing className', () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <div
        className="base"
        mix={[
          css({ color: 'red' }),
          css({
            backgroundColor: 'blue',
          }),
        ]}
      />,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    let classNames = div.className.split(/\s+/).filter(Boolean)
    let generated = classNames.filter((name) => name.startsWith('rmxc-'))
    expect(classNames).toContain('base')
    expect(generated.length).toBe(2)
    expect(new Set(generated).size).toBe(2)
  })

  it('coexists with existing class/className props', () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <div
        class="from-class"
        className="from-classname"
        mix={[
          css({
            borderColor: 'black',
            borderStyle: 'solid',
            borderWidth: 1,
          }),
        ]}
      />,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    let classNames = div.className.split(/\s+/).filter(Boolean)
    expect(classNames).toContain('from-class')
    expect(classNames).toContain('from-classname')
    expect(classNames.some((name) => name.startsWith('rmxc-'))).toBe(true)
  })

  it('supports keyframes and nested media rules', () => {
    let container = document.createElement('div')
    document.body.appendChild(container)
    let root = createRoot(container)

    root.render(
      <div
        mix={[
          css({
            animationName: 'fade-in',
            animationDuration: '1s',
            '@keyframes fade-in': {
              from: {
                opacity: 0,
                transform: 'translateY(8px)',
                '&:hover': { color: 'red' } as any,
              },
              to: {
                opacity: 1,
              },
              skipped: null as any,
            },
            '@media (min-width: 1px)': {
              color: 'rgb(1, 2, 3)',
              '&:hover': {
                color: 'rgb(4, 5, 6)',
              },
            },
          }),
        ]}
      >
        Animated
      </div>,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    expect(div.className).toMatch(/rmxc-/)
    let cssTexts = readAdoptedCssTexts()
    expect(cssTexts.some((text) => text.includes('@keyframes fade-in'))).toBe(true)
    expect(cssTexts.some((text) => text.includes('@media (min-width: 1px)'))).toBe(true)
  })

  it('skips undefined conditional selectors and at-rules', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <div
        mix={[
          css({
            color: 'rgb(10, 20, 30)',
            '@supports (display: grid)': undefined,
            '&[data-active="true"]': undefined,
            '&:focus': {
              outlineWidth: 2,
              outlineStyle: 'solid',
            },
          }),
        ]}
      >
        Conditional rules
      </div>,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    expect(div.className).toMatch(/rmxc-/)
  })

  it('handles empty keyframe steps and at-rule bodies', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <div
        mix={[
          css({
            animationName: 'empty-frames',
            animationDuration: '1s',
            '@keyframes empty-frames': {
              from: {
                '&:hover': { color: 'red' } as any,
              },
              to: {},
            },
            '@media (min-width: 1px)': {},
          }),
        ]}
      >
        Empty blocks
      </div>,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    expect(div.className).toMatch(/rmxc-/)

    let cssTexts = readAdoptedCssTexts()
    expect(cssTexts.some((text) => text.includes('@keyframes empty-frames'))).toBe(true)
  })

  it('releases dynamic client-only rules on style change and unmount', () => {
    // Dynamic style objects mint a new class per value. Client-only rules are
    // refcounted, so toggling between values must drop the abandoned rule and
    // unmounting must return the registry to its starting size.
    let container = document.createElement('div')
    document.body.appendChild(container)
    let root = createRoot(container)
    let baseline = countAdoptedRules()

    root.render(<div mix={[css({ width: '11px' })]}>Dynamic</div>)
    root.flush()
    let div = container.querySelector('div')
    invariant(div)
    let firstClass = div.className
    expect(countAdoptedRules()).toBe(baseline + 1)

    root.render(<div mix={[css({ width: '22px' })]}>Dynamic</div>)
    root.flush()
    expect(div.className).not.toBe(firstClass)
    expect(countAdoptedRules()).toBe(baseline + 1)
    expect(ruleTextPresent(`.${firstClass}`)).toBe(false)

    root.render(null)
    root.flush()
    expect(countAdoptedRules()).toBe(baseline)

    root.dispose()
    container.remove()
  })

  it('keeps a dynamic rule alive while a mixin persists the node for an exit transition', async () => {
    // A sibling mixin can persist the host node past unmount (e.g. exit
    // transitions). The css rule must keep styling the node until the
    // persistence teardown settles — only then may the refcount drop.
    let releaseExit: (() => void) | undefined
    let exitGate = new Promise<void>((resolve) => {
      releaseExit = resolve
    })
    let persistOnRemove = createMixin<Element>((handle) => {
      handle.addEventListener('beforeRemove', (event) => {
        ;(event as MixinBeforeRemoveEvent).persistNode(async () => {
          await exitGate
        })
      })
    })

    let container = document.createElement('div')
    document.body.appendChild(container)
    let root = createRoot(container)

    root.render(
      <div id="exiting" mix={[css({ color: 'rgb(77, 88, 99)' }), persistOnRemove()]}>
        Exiting
      </div>,
    )
    root.flush()

    let div = container.querySelector('#exiting')
    invariant(div)
    expect(getComputedStyle(div).color).toBe('rgb(77, 88, 99)')

    // Unmount — the node persists for the exit transition and must stay styled.
    root.render(null)
    root.flush()
    expect(container.querySelector('#exiting')).toBe(div)
    expect(getComputedStyle(div).color).toBe('rgb(77, 88, 99)')

    // Finish the exit: node is removed and the dynamic rule is released.
    invariant(releaseExit)
    releaseExit()
    await new Promise((resolve) => setTimeout(resolve, 0))
    root.flush()

    expect(container.querySelector('#exiting')).toBe(null)
    expect(ruleTextPresent('rgb(77, 88, 99)')).toBe(false)

    root.dispose()
    container.remove()
  })
})

function countAdoptedRules(): number {
  return Array.from(document.adoptedStyleSheets).reduce(
    (count, sheet) => count + sheet.cssRules.length,
    0,
  )
}

function ruleTextPresent(text: string): boolean {
  return readAdoptedCssTexts().some((cssText) => cssText.includes(text))
}

function readAdoptedCssTexts(): string[] {
  let texts: string[] = []
  for (let sheet of document.adoptedStyleSheets) {
    let rules = Array.from(sheet.cssRules).map((rule) => rule.cssText)
    texts.push(rules.join('\n'))
  }
  return texts
}
