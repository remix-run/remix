import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { processStyle } from './style.ts'

function createElement(tag = 'div'): HTMLElement {
  let element = document.createElement(tag)
  document.body.appendChild(element)
  return element
}

describe('processStyle', () => {
  let styleCache: Map<string, { className: string; css: string }>

  beforeEach(() => {
    styleCache = new Map()

    document.querySelectorAll('style[data-remix-style]').forEach((el) => el.remove())
  })

  afterEach(() => {
    document.querySelectorAll('style[data-remix-style]').forEach((el) => el.remove())
  })

  it('applies simple styles to DOM elements', () => {
    let element = createElement()

    let result = processStyle(
      {
        color: 'red',
        backgroundColor: 'blue',
        fontSize: '16px',
      },
      styleCache,
    )

    element.className = result.className!

    expect(result.className).toMatch(/^rmx-/)

    // Note: No longer auto-injecting CSS in processStyle
    // So we won't check for injected style elements in these tests
    expect(result.css).toContain('color: red')
    expect(result.css).toContain('background-color: blue')
    expect(result.css).toContain('font-size: 16px')
  })

  it('applies pseudo-selectors with & syntax', () => {
    let element = createElement()

    let result = processStyle(
      {
        color: 'red',
        '&:hover': {
          color: 'blue',
          backgroundColor: 'yellow',
        },
      },
      styleCache,
    )

    element.className = result.className!

    expect(result.className).toMatch(/^rmx-/)

    // Check that CSS contains nested hover styles
    expect(result.css).toContain(`${result.className} {`)
    expect(result.css).toContain('&:hover')
    expect(result.css).toContain('color: blue')
    expect(result.css).toContain('background-color: yellow')
  })

  it('applies child selectors without & syntax', () => {
    let element = createElement()
    let child = createElement()
    child.className = 'child'
    element.appendChild(child)

    let result = processStyle(
      {
        color: 'red',
        '.child': {
          color: 'blue',
          fontSize: '14px',
        },
      },
      styleCache,
    )

    element.className = result.className!

    expect(result.className).toMatch(/^rmx-/)

    // Check that CSS contains nested child selector styles
    expect(result.css).toContain(`${result.className} {`)
    expect(result.css).toContain('.child')
    expect(result.css).toContain('color: blue')
    expect(result.css).toContain('font-size: 14px')
  })

  it('applies attribute selectors with & syntax', () => {
    let element = createElement()
    element.setAttribute('aria-selected', 'true')

    let result = processStyle(
      {
        color: 'red',
        "&[aria-selected='true']": {
          color: 'blue',
          backgroundColor: 'yellow',
        },
      },
      styleCache,
    )

    element.className = result.className!

    expect(result.className).toMatch(/^rmx-/)

    // Check that CSS contains nested attribute selector
    expect(result.css).toContain(`${result.className} {`)
    expect(result.css).toContain(`&[aria-selected='true']`)
    expect(result.css).toContain('color: blue')
    expect(result.css).toContain('background-color: yellow')
  })

  it('applies media queries with nested pseudo-selectors', () => {
    let element = createElement()

    let result = processStyle(
      {
        padding: '16px',
        '@media (max-width: 768px)': {
          padding: '8px 16px',
          fontSize: '14px',
          '&:hover': {
            transform: 'translateY(1.2px)',
            backgroundColor: 'blue',
          },
        },
      },
      styleCache,
    )

    element.className = result.className!

    expect(result.className).toMatch(/^rmx-/)

    // Check that CSS contains media query content
    expect(result.css).toContain(`${result.className}`)
    expect(result.css).toContain('padding: 16px')
    expect(result.css).toContain('@media (max-width: 768px)')
    expect(result.css).toContain('padding: 8px 16px')
    expect(result.css).toContain('font-size: 14px')
    expect(result.css).toContain('&:hover')
    expect(result.css).toContain('transform: translateY(1.2px)')
    expect(result.css).toContain('background-color: blue')
  })

  it('applies simple media queries', () => {
    let element = createElement()

    let result = processStyle(
      {
        color: 'red',
        '@media (max-width: 768px)': {
          color: 'blue',
          fontSize: '14px',
        },
      },
      styleCache,
    )

    element.className = result.className!

    expect(result.className).toMatch(/^rmx-/)

    // Check that CSS contains media query
    expect(result.css).toContain('@media (max-width: 768px)')
    expect(result.css).toContain('color: blue')
    expect(result.css).toContain('font-size: 14px')
  })

  it('deduplicates identical style objects', () => {
    let element1 = createElement()
    let element2 = createElement()

    let style1 = {
      color: 'red',
      '&:hover': { color: 'blue' },
    }

    let style2 = {
      color: 'red',
      '&:hover': { color: 'blue' },
    }

    let result1 = processStyle(style1, styleCache)
    let result2 = processStyle(style2, styleCache)

    element1.className = result1.className!
    element2.className = result2.className!

    expect(result1.className).toBe(result2.className)
    expect(result1.css).toBe(result2.css)
  })

  it('generates different class names for different styles', () => {
    let element1 = createElement()
    let element2 = createElement()

    let result1 = processStyle(
      {
        color: 'red',
        '&:hover': { color: 'blue' },
      },
      styleCache,
    )

    let result2 = processStyle(
      {
        color: 'blue',
        '&:hover': { color: 'red' },
      },
      styleCache,
    )

    element1.className = result1.className!
    element2.className = result2.className!

    expect(result1.className).not.toBe(result2.className)
    expect(result1.css).not.toBe(result2.css)
  })

  it('handles empty style objects', () => {
    let result = processStyle({}, styleCache)

    expect(result.className).toBe('')
    expect(result.css).toBe('')
  })

  it('generates nested CSS wholesale for comma-separated attribute selectors', () => {
    let result = processStyle(
      {
        color: 'red',
        '&[aria-selected], &[rmx-focus]': {
          color: 'blue',
        },
      },
      styleCache,
    )

    expect(result.className).toMatch(/^rmx-/)
    expect(result.css).toContain(`${result.className} {`)
    // Ensure we did not expand or parse the nested selector, it should appear verbatim
    expect(result.css).toContain('&[aria-selected], &[rmx-focus]')
    expect(result.css).toContain('color: blue')
  })

  it('produces exact nested CSS for comma-separated attribute selectors', () => {
    let result = processStyle(
      {
        color: 'red',
        '&[aria-selected], &[rmx-focus]': {
          color: 'blue',
        },
      },
      styleCache,
    )

    let expected =
      `.${result.className} {\n` +
      `  color: red;\n` +
      `  &[aria-selected], &[rmx-focus] {\n` +
      `    color: blue;\n` +
      `  }\n` +
      `}`

    expect(result.css).toBe(expected)
  })

  it('processStyle > filters out undefined and null values', () => {
    let styleCache = new Map()
    let result = processStyle(
      {
        color: 'red',
        fontSize: undefined,
        margin: null,
        padding: '10px',
        backgroundColor: undefined,
        '&:hover': {
          color: 'blue',
          border: undefined,
          outline: null,
        },
      },
      styleCache,
    )

    expect(result.className).toBeTruthy()
    expect(result.css).toContain('color: red')
    expect(result.css).toContain('padding: 10px')
    expect(result.css).toContain('.rmx-')
    expect(result.css).toContain(':hover')
    expect(result.css).toContain('color: blue')

    // Should NOT contain undefined or null values
    expect(result.css).not.toContain('undefined')
    expect(result.css).not.toContain('null')
    expect(result.css).not.toContain('font-size:')
    expect(result.css).not.toContain('margin:')
    expect(result.css).not.toContain('background-color:')
    expect(result.css).not.toContain('border:')
    expect(result.css).not.toContain('outline:')
  })

  it('emits @function blocks before the class and supports usage in declarations', () => {
    let styleCache = new Map()
    let result = processStyle(
      {
        '@function --alpha(--color, --opacity)': {
          result: 'rgb(from var(--color) r g b / var(--opacity))',
        },
        background: '--alpha(red, 80%)',
      },
      styleCache,
    )

    expect(result.className).toBeTruthy()
    expect(result.css.trim().startsWith('@function --alpha(')).toBe(true)
    expect(result.css).toContain('result: rgb(from var(--color) r g b / var(--opacity));')
    expect(result.css).toContain(`.${result.className} {`)
    expect(result.css).toContain('background: --alpha(red, 80%);')
  })
})
