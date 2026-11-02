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

  it('deduplicates omitted and undefined style properties', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let first = processStyleClass(
      { color: 'red', backgroundColor: undefined, '&:hover': undefined },
      cache,
    )
    let second = processStyleClass({ color: 'red' }, cache)

    expect(first.selector).toBe(second.selector)
    expect(first.css).toBe(second.css)
    expect(cache.size).toBe(1)
  })

  it('returns empty selector/css for empty objects', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass({}, cache)
    expect(result.selector).toBe('')
    expect(result.css).toBe('')
  })

  it('only appends px to numeric values of length properties', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass({ webkitLineClamp: 4, flex: 1, marginTop: 4 }, cache)

    expect(result.css).toContain('  -webkit-line-clamp: 4;')
    expect(result.css).toContain('flex: 1;')
    expect(result.css).toContain('margin-top: 4px;')
  })

  it('keeps custom property names as written', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass({ '--gapSize': 4 }, cache)

    expect(result.css).toContain('--gapSize: 4;')
  })

  it('preserves numeric values in nested rules and keyframes', () => {
    let result = processStyleClass(
      {
        animation: 2,
        borderImage: 3,
        ':hover': { maskBorderWidth: 1.5, marginTop: 4 },
        '@media print': { bookmarkLevel: 2, floatDefer: -1 },
        '@keyframes threshold': {
          from: { shapeImageThreshold: 0.25 },
          to: { shapeImageThreshold: 0.75 },
        },
      },
      new Map(),
    )
    let css = result.css.replace(/\s+/g, ' ')

    expect(css).toContain('animation: 2;')
    expect(css).toContain('border-image: 3;')
    expect(css).toContain(':hover { mask-border-width: 1.5; margin-top: 4px; }')
    expect(css).toContain('bookmark-level: 2; float-defer: -1;')
    expect(css).toContain(
      '@keyframes threshold { from { shape-image-threshold: 0.25; } to { shape-image-threshold: 0.75; } }',
    )
  })

  it('drops non-finite numbers', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass({ color: 'red', width: Number.NaN, height: Infinity }, cache)

    expect(result.css).toContain('color: red;')
    expect(result.css).not.toContain('width')
    expect(result.css).not.toContain('height')
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

  it('keeps line-clamp unitless in every spelling', () => {
    expect(normalizeCssValue('lineClamp', 4)).toBe('4')
    expect(normalizeCssValue('webkitLineClamp', 4)).toBe('4')
    expect(normalizeCssValue('WebkitLineClamp', 4)).toBe('4')
    expect(normalizeCssValue('-webkit-line-clamp', 4)).toBe('4')
  })

  it('keeps other unitless properties unitless', () => {
    expect(normalizeCssValue('flex', 1)).toBe('1')
    expect(normalizeCssValue('msFlex', 1)).toBe('1')
    expect(normalizeCssValue('scale', 2)).toBe('2')
    expect(normalizeCssValue('animationIterationCount', 3)).toBe('3')
    expect(normalizeCssValue('tabSize', 4)).toBe('4')
    expect(normalizeCssValue('strokeWidth', 2)).toBe('2')
    expect(normalizeCssValue('fillOpacity', 0.5)).toBe('0.5')
  })

  it('uses the unitless branch of numeric shorthands', () => {
    expect(normalizeCssValue('animation', 2)).toBe('2')
    expect(normalizeCssValue('WebkitAnimation', 0.5)).toBe('0.5')
    expect(normalizeCssValue('borderImage', 3)).toBe('3')
    expect(normalizeCssValue('maskBorder', 0.5)).toBe('0.5')
    expect(normalizeCssValue('webkitMaskBoxImage', 3)).toBe('3')
  })

  it('keeps mask slices and border-width multipliers unitless', () => {
    expect(normalizeCssValue('maskBorderOutset', 1.5)).toBe('1.5')
    expect(normalizeCssValue('mask-border-slice', 2.5)).toBe('2.5')
    expect(normalizeCssValue('maskBorderWidth', 3.5)).toBe('3.5')
    expect(normalizeCssValue('WebkitMaskBoxImageOutset', 1.5)).toBe('1.5')
    expect(normalizeCssValue('webkitMaskBoxImageSlice', 2.5)).toBe('2.5')
    expect(normalizeCssValue('-webkit-mask-box-image-width', 3.5)).toBe('3.5')
  })

  it('keeps text and layout counts unitless', () => {
    expect(normalizeCssValue('hyphenateLimitChars', 6)).toBe('6')
    expect(normalizeCssValue('hyphenate-limit-lines', 2)).toBe('2')
    expect(normalizeCssValue('msHyphenateLimitChars', 6)).toBe('6')
    expect(normalizeCssValue('-ms-hyphenate-limit-lines', 2)).toBe('2')
    expect(normalizeCssValue('columnSpan', 2)).toBe('2')
    expect(normalizeCssValue('flexLineCount', 3)).toBe('3')
    expect(normalizeCssValue('maxLines', 4)).toBe('4')
  })

  it('keeps shape thresholds and reading order unitless', () => {
    expect(normalizeCssValue('shapeImageThreshold', 0.5)).toBe('0.5')
    expect(normalizeCssValue('reading-order', -2)).toBe('-2')
  })

  it('keeps paged-media and speech numbers unitless', () => {
    expect(normalizeCssValue('bookmarkLevel', 2)).toBe('2')
    expect(normalizeCssValue('float-defer', -1)).toBe('-1')
    expect(normalizeCssValue('voiceBalance', -0.5)).toBe('-0.5')
  })

  it('keeps font ratios and math depth unitless', () => {
    expect(normalizeCssValue('fontSizeAdjust', 0.5)).toBe('0.5')
    expect(normalizeCssValue('initialLetter', 2.5)).toBe('2.5')
    expect(normalizeCssValue('mathDepth', -1)).toBe('-1')
  })

  it('keeps the legacy Mozilla broken-image flag unitless', () => {
    expect(normalizeCssValue('MozForceBrokenImageIcon', 1)).toBe('1')
    expect(normalizeCssValue('-moz-force-broken-image-icon', 1)).toBe('1')
  })

  it('preserves explicit units and multi-part values', () => {
    expect(normalizeCssValue('maskBorderWidth', '3px')).toBe('3px')
    expect(normalizeCssValue('animationDuration', '200ms')).toBe('200ms')
    expect(normalizeCssValue('rotate', '45deg')).toBe('45deg')
    expect(normalizeCssValue('shapeImageThreshold', '50%')).toBe('50%')
    expect(normalizeCssValue('hyphenateLimitChars', '6 3 2')).toBe('6 3 2')
    expect(normalizeCssValue('animation', '200ms ease-in 2 slide')).toBe('200ms ease-in 2 slide')
  })

  it('leaves zero, strings, and custom properties untouched', () => {
    expect(normalizeCssValue('marginTop', 0)).toBe('0')
    expect(normalizeCssValue('marginTop', '4em')).toBe('4em')
    expect(normalizeCssValue('--gap', 4)).toBe('4')
  })
})
