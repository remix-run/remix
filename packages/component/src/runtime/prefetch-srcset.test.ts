import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { normalizeSrcset } from './prefetch-srcset.ts'

describe('prefetch source sets', () => {
  it('resolves candidate URLs and preserves width, density, and comma-containing URLs', () => {
    expect(
      normalizeSrcset(
        'small.jpg 400w, image,a.jpg 1200w, ../large.jpg 2x',
        'https://example.com/assets/',
      ),
    ).toBe(
      'https://example.com/assets/small.jpg 400w, https://example.com/assets/image,a.jpg 1200w, https://example.com/large.jpg 2x',
    )
    expect(normalizeSrcset('plain.jpg, doubled.jpg 2x', 'https://example.com/')).toBe(
      'https://example.com/plain.jpg, https://example.com/doubled.jpg 2x',
    )
  })
  it('drops malformed descriptors, invalid URLs, and non-HTTP candidates independently', () => {
    expect(normalizeSrcset('zero.jpg -0x, negative.jpg -1x', 'https://example.com/')).toBe(
      'https://example.com/zero.jpg -0x',
    )
    expect(
      normalizeSrcset(
        'bad.jpg 1x 2x, data:image/png,abc 1x, http://[ 2x, bad.jpg 0w, tall.jpg 200h, width.jpg 400w 200h, good.jpg 1e0x',
        'https://example.com/',
      ),
    ).toBe('https://example.com/width.jpg 400w 200h, https://example.com/good.jpg 1e0x')
    expect(normalizeSrcset('bad.jpg calc(1, 2)x, good.jpg 2x', 'https://example.com/')).toBe(
      'https://example.com/good.jpg 2x',
    )
  })
})
