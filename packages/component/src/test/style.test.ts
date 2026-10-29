import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { normalizeCssValue, processStyleClass } from '../style/style.ts'

describe('processStyleClass', () => {
  it('returns class selectors and css text', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass({ color: 'red', fontSize: '16px' }, cache)

    expect(result.selector).toMatch(/^rmxc-/)
    expect(result.css).toContain(`.${result.selector}`)
    expect(result.css).toContain('color: red')
    expect(result.css).toContain('font-size: 16px')
  })

  it('deduplicates identical style objects', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let first = processStyleClass({ color: 'red', '&:hover': { color: 'blue' } }, cache)
    let second = processStyleClass({ color: 'red', '&:hover': { color: 'blue' } }, cache)

    expect(first.selector).toBe(second.selector)
    expect(first.css).toBe(second.css)
  })

  it('returns empty selector/css for empty objects', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass({}, cache)
    expect(result.selector).toBe('')
    expect(result.css).toBe('')
  })

  it('only appends px to numeric values of length properties', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass({ WebkitLineClamp: 4, flex: 1, marginTop: 4 }, cache)

    expect(result.css).toContain('-webkit-line-clamp: 4;')
    expect(result.css).toContain('flex: 1;')
    expect(result.css).toContain('margin-top: 4px;')
  })

  it('keeps nested selectors and media queries', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass(
      {
        color: 'black',
        ':hover': { color: 'red' },
        '& div': {
          color: 'green',
          '& p': { color: 'blue' },
          '@media (hover: hover)': {
            '& a': { color: 'purple' },
          },
        },
        '@media (min-width: 768px)': {
          fontSize: '16px',
        },
      },
      cache,
    )

    let css = result.css.replace(/\s+/g, ' ')

    expect(css).toContain(':hover { color: red; }')
    expect(css).toContain(
      '& div { color: green; & p { color: blue; } @media (hover: hover) { & a { color: purple; } } }',
    )
    expect(result.css).toContain('@media (min-width: 768px)')
    expect(result.css).toContain('font-size: 16px')
    expect(result.css).not.toContain('[object Object]')
  })
})

describe('normalizeCssValue', () => {
  it('appends px to numeric length values', () => {
    expect(normalizeCssValue('marginTop', 4)).toBe('4px')
    expect(normalizeCssValue('width', 1.5)).toBe('1.5px')
  })

  it('keeps line-clamp unitless, including the -webkit- prefixed form', () => {
    expect(normalizeCssValue('lineClamp', 4)).toBe('4')
    expect(normalizeCssValue('WebkitLineClamp', 4)).toBe('4')
    expect(normalizeCssValue('-webkit-line-clamp', 4)).toBe('4')
  })

  it('keeps the flex shorthand unitless', () => {
    expect(normalizeCssValue('flex', 1)).toBe('1')
    expect(normalizeCssValue('msFlex', 1)).toBe('1')
  })

  it('keeps other unitless properties unitless', () => {
    expect(normalizeCssValue('scale', 2)).toBe('2')
    expect(normalizeCssValue('animationIterationCount', 3)).toBe('3')
    expect(normalizeCssValue('gridRowStart', 2)).toBe('2')
    expect(normalizeCssValue('tabSize', 4)).toBe('4')
    expect(normalizeCssValue('zIndex', 10)).toBe('10')
  })

  it('keeps SVG unitless properties unitless', () => {
    expect(normalizeCssValue('strokeWidth', 2)).toBe('2')
    expect(normalizeCssValue('fillOpacity', 0.5)).toBe('0.5')
    expect(normalizeCssValue('strokeOpacity', 0.5)).toBe('0.5')
  })

  it('leaves zero, strings, and custom properties untouched', () => {
    expect(normalizeCssValue('marginTop', 0)).toBe('0')
    expect(normalizeCssValue('marginTop', '4em')).toBe('4em')
    expect(normalizeCssValue('--gap', 4)).toBe('4')
  })
})
