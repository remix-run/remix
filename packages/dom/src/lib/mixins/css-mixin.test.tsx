import { describe, expect, it } from 'vitest'
import { createDomReconciler } from '../dom-reconciler.ts'
import { css } from './css-mixin.tsx'

describe('css mixin', () => {
  function flushTwice(root: { flush(): void }) {
    root.flush()
    root.flush()
  }

  it('applies a generated class and stylesheet rule', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          css({
            color: 'red',
            fontSize: 14,
          }),
        ]}
      >
        hello
      </button>,
    )
    flushTwice(root)

    let button = container.firstElementChild as HTMLButtonElement
    expect(button).toBeTruthy()
    let generatedClass = button.className
    expect(generatedClass.includes('rmx-css-')).toBe(true)

    let styleElement = document.head.querySelector('style[data-rmx-css-mixin]')
    expect(styleElement).toBeTruthy()
    let cssText = styleElement?.textContent ?? ''
    expect(cssText.includes(`.${generatedClass}`)).toBe(true)
    expect(cssText.includes('color:red;')).toBe(true)
    expect(cssText.includes('font-size:14px;')).toBe(true)
  })

  it('reuses the same class/rule for equivalent styles and cleans up on unmount', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)
    let styles = { color: 'hotpink', paddingTop: 8 }

    root.render(
      <section>
        <button mix={[css(styles)]}>a</button>
        <button mix={[css({ paddingTop: 8, color: 'hotpink' })]}>b</button>
      </section>,
    )
    flushTwice(root)

    let section = container.firstElementChild as HTMLElement
    let first = section.children[0] as HTMLButtonElement
    let second = section.children[1] as HTMLButtonElement
    expect(first.className).toBeTruthy()
    expect(first.className).toBe(second.className)

    let styleElement = document.head.querySelector('style[data-rmx-css-mixin]')
    let cssText = styleElement?.textContent ?? ''
    expect(cssText.includes(`.${first.className}`)).toBe(true)

    root.render(null)
    flushTwice(root)

    expect(container.firstElementChild).toBeNull()
  })

  it('updates className composition and stylesheet when style input changes', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button className="base" mix={[css({ color: 'red' })]}>
        hello
      </button>,
    )
    flushTwice(root)

    let button = container.firstElementChild as HTMLButtonElement
    let firstClassName = button.className
    let firstGeneratedClass = firstClassName
      .split(' ')
      .find((value) => value.startsWith('rmx-css-'))
    if (!firstGeneratedClass) {
      throw new Error('expected generated css class')
    }
    expect(firstClassName.includes('base')).toBe(true)
    expect(firstClassName.includes('rmx-css-')).toBe(true)

    root.render(
      <button className="base" mix={[css({ color: 'blue' })]}>
        hello
      </button>,
    )
    flushTwice(root)

    let updated = container.firstElementChild as HTMLButtonElement
    let secondClassName = updated.className
    expect(secondClassName.includes('base')).toBe(true)
    expect(secondClassName.includes('rmx-css-')).toBe(true)
    expect(secondClassName).not.toBe(firstClassName)

    let styleElement = document.head.querySelector('style[data-rmx-css-mixin]')
    let cssText = styleElement?.textContent ?? ''
    expect(cssText.includes('color:blue;')).toBe(true)
    expect(cssText.includes(`.${firstGeneratedClass}`)).toBe(false)
  })

  it('supports nested selectors, at-rules, and invalid style inputs', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          css({
            color: 'black',
            '&:hover': { color: 'red' },
            ':focus': { opacity: 0.8 },
            '@media (min-width: 1px)': { fontSize: 12 },
            '--accent': 2,
            child: { lineHeight: 1.2 },
          }),
        ]}
      />,
    )
    flushTwice(root)

    let button = container.firstElementChild as HTMLButtonElement
    expect(button.className.includes('rmx-css-')).toBe(true)
    let styleElement = document.head.querySelector('style[data-rmx-css-mixin]')
    let cssText = styleElement?.textContent ?? ''
    expect(cssText.includes(':hover')).toBe(true)
    expect(cssText.includes(':focus')).toBe(true)
    expect(cssText.includes('@media (min-width: 1px)')).toBe(true)
    expect(cssText.includes('--accent:2px;')).toBe(true)

    root.render(<button mix={[css(null)]} />)
    flushTwice(root)
    expect((container.firstElementChild as HTMLButtonElement).className).toBe('')

    root.render(<button mix={[css([] as any)]} />)
    flushTwice(root)
    expect((container.firstElementChild as HTMLButtonElement).className).toBe('')
  })
})
