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

  it('applies pseudo-elements with & syntax', () => {
    let element = createElement()

    let result = processStyle(
      {
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '0',
          left: '0',
          width: '10px',
          height: '10px',
          backgroundColor: 'red',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '0',
          right: '0',
          width: '10px',
          height: '10px',
          backgroundColor: 'blue',
        },
      },
      styleCache,
    )

    element.className = result.className!

    expect(result.className).toMatch(/^rmx-/)

    // Check that CSS contains pseudo-element styles
    expect(result.css).toContain(`  &::before {`)
    expect(result.css).toContain(`  &::after {`)
    expect(result.css).toContain('content: ""')
    expect(result.css).toContain('background-color: red')
    expect(result.css).toContain('background-color: blue')
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

  it('generates nested CSS wholesale for comma-separated attribute selectors', () => {
    let result = processStyle(
      {
        color: 'red',
        '&[aria-selected], &[rmx-focus]': {
          color: 'blue',
        },
      },
      new Map(),
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
      new Map(),
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

  it('normalizes numeric values to include px units for properties that need them', () => {
    let result = processStyle(
      {
        backgroundColor: 'red',
        width: 100,
        height: 200,
        margin: 10,
        padding: 20,
        top: 5,
        left: 15,
      },
      styleCache,
    )

    expect(result.className).toMatch(/^rmx-/)
    // Numeric values should be normalized to include 'px'
    expect(result.css).toContain('width: 100px')
    expect(result.css).toContain('height: 200px')
    expect(result.css).toContain('margin: 10px')
    expect(result.css).toContain('padding: 20px')
    expect(result.css).toContain('top: 5px')
    expect(result.css).toContain('left: 15px')
    // String values should remain unchanged
    expect(result.css).toContain('background-color: red')
  })

  it('preserves unitless numeric values for properties that should be unitless', () => {
    let result = processStyle(
      {
        zIndex: 10,
        opacity: 0.5,
        flexGrow: 2,
        fontWeight: 700,
        order: 1,
      },
      styleCache,
    )

    expect(result.className).toMatch(/^rmx-/)
    // Unitless properties should remain unitless
    expect(result.css).toContain('z-index: 10')
    expect(result.css).toContain('opacity: 0.5')
    expect(result.css).toContain('flex-grow: 2')
    expect(result.css).toContain('font-weight: 700')
    expect(result.css).toContain('order: 1')
    // Should not contain 'px' for these properties
    expect(result.css).not.toContain('z-index: 10px')
    expect(result.css).not.toContain('opacity: 0.5px')
  })

  it('preserves zero values as 0 (not 0px)', () => {
    let result = processStyle(
      {
        width: 0,
        height: 0,
        margin: 0,
        zIndex: 0,
      },
      styleCache,
    )

    expect(result.className).toMatch(/^rmx-/)
    // Zero values should remain as 0
    expect(result.css).toContain('width: 0')
    expect(result.css).toContain('height: 0')
    expect(result.css).toContain('margin: 0')
    expect(result.css).toContain('z-index: 0')
    // Should not contain '0px'
    expect(result.css).not.toContain('width: 0px')
    expect(result.css).not.toContain('height: 0px')
  })

  it('preserves CSS custom properties (variables) without normalization', () => {
    let result = processStyle(
      {
        '--custom-width': 100,
        '--custom-color': 'blue',
        width: 200,
      },
      styleCache,
    )

    expect(result.className).toMatch(/^rmx-/)
    // CSS variables should remain as numbers (not normalized)
    expect(result.css).toContain('--custom-width: 100')
    expect(result.css).not.toContain('--custom-width: 100px')
    // Regular properties should be normalized
    expect(result.css).toContain('width: 200px')
  })

  it('normalizes numeric values in nested selectors', () => {
    let result = processStyle(
      {
        width: 100,
        '&:hover': {
          width: 150,
          height: 200,
        },
      },
      styleCache,
    )

    expect(result.className).toMatch(/^rmx-/)
    // Base declaration
    expect(result.css).toContain('width: 100px')
    // Nested selector
    expect(result.css).toContain('width: 150px')
    expect(result.css).toContain('height: 200px')
  })
})
