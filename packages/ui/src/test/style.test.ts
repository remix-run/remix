import { describe, it, expect } from 'vitest'
import { processStyleClass } from '../lib/style/lib/style.ts'

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

  it('keeps nested selectors and media queries', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass(
      {
        color: 'black',
        ':hover': { color: 'red' },
        '@media (min-width: 768px)': {
          fontSize: '16px',
        },
      },
      cache,
    )

    expect(result.css).toContain(':hover')
    expect(result.css).toContain('@media (min-width: 768px)')
    expect(result.css).toContain('font-size: 16px')
  })
})
