import { describe, expect, it } from 'vitest'
import { createRoot } from '../vdom.ts'
import { invariant } from '../invariant.ts'
import { css } from './css-mixin.tsx'

describe('css mixin', () => {
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
})

function readAdoptedCssTexts(): string[] {
  let texts: string[] = []
  for (let sheet of document.adoptedStyleSheets) {
    let rules = Array.from(sheet.cssRules).map((rule) => rule.cssText)
    texts.push(rules.join('\n'))
  }
  return texts
}
