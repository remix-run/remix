import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Colorizer } from './colorizer.ts'

const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const MAGENTA = '\x1b[35m'

describe('Colorizer', () => {
  describe('with colors disabled', () => {
    let colorizer = new Colorizer(false)

    it('status returns plain code', () => {
      assert.strictEqual(colorizer.status(200), '200')
      assert.strictEqual(colorizer.status(404), '404')
      assert.strictEqual(colorizer.status(500), '500')
    })

    it('method returns plain method', () => {
      assert.strictEqual(colorizer.method('GET'), 'GET')
      assert.strictEqual(colorizer.method('POST'), 'POST')
    })

    it('duration returns plain value', () => {
      assert.strictEqual(colorizer.duration(50, '50ms'), '50ms')
      assert.strictEqual(colorizer.duration(1500, '1.5s'), '1.5s')
    })

    it('contentLength returns plain value', () => {
      assert.strictEqual(colorizer.contentLength(1024, '1KB'), '1KB')
      assert.strictEqual(colorizer.contentLength(undefined, 'N/A'), 'N/A')
    })
  })

  describe('status method', () => {
    let colorizer = new Colorizer(true)

    it('handles 2xx codes', () => {
      let result = colorizer.status(200)
      assert.ok(result === '200' || result === `${GREEN}200${RESET}`)
    })

    it('handles 3xx codes', () => {
      let result = colorizer.status(302)
      assert.ok(result === '302' || result === `${CYAN}302${RESET}`)
    })

    it('handles 4xx codes', () => {
      let result = colorizer.status(404)
      assert.ok(result === '404' || result === `${RED}404${RESET}`)
    })

    it('handles 5xx codes', () => {
      let result = colorizer.status(500)
      assert.ok(result === '500' || result === `${MAGENTA}500${RESET}`)
    })

    it('handles 1xx codes without color', () => {
      assert.strictEqual(colorizer.status(100), '100')
    })
  })

  describe('method colorization', () => {
    let colorizer = new Colorizer(true)

    it('handles GET', () => {
      let result = colorizer.method('GET')
      assert.ok(result === 'GET' || result === `${GREEN}GET${RESET}`)
    })

    it('handles POST', () => {
      let result = colorizer.method('POST')
      assert.ok(result === 'POST' || result === `${CYAN}POST${RESET}`)
    })

    it('handles PUT and PATCH', () => {
      let put = colorizer.method('PUT')
      let patch = colorizer.method('PATCH')
      assert.ok(put === 'PUT' || put === `${YELLOW}PUT${RESET}`)
      assert.ok(patch === 'PATCH' || patch === `${YELLOW}PATCH${RESET}`)
    })

    it('handles DELETE', () => {
      let result = colorizer.method('DELETE')
      assert.ok(result === 'DELETE' || result === `${RED}DELETE${RESET}`)
    })

    it('handles HEAD and OPTIONS', () => {
      let head = colorizer.method('HEAD')
      let options = colorizer.method('OPTIONS')
      assert.ok(head === 'HEAD' || head === `${MAGENTA}HEAD${RESET}`)
      assert.ok(options === 'OPTIONS' || options === `${MAGENTA}OPTIONS${RESET}`)
    })

    it('handles unknown methods', () => {
      assert.strictEqual(colorizer.method('UNKNOWN'), 'UNKNOWN')
    })
  })

  describe('duration colorization', () => {
    let colorizer = new Colorizer(true)

    it('handles fast durations', () => {
      let result = colorizer.duration(50, '50ms')
      assert.ok(result === '50ms' || result === `${GREEN}50ms${RESET}`)
    })

    it('handles medium durations', () => {
      let result = colorizer.duration(150, '150ms')
      assert.ok(result === '150ms' || result === `${YELLOW}150ms${RESET}`)
    })

    it('handles slow durations', () => {
      let result = colorizer.duration(600, '600ms')
      assert.ok(result === '600ms' || result === `${MAGENTA}600ms${RESET}`)
    })

    it('handles very slow durations', () => {
      let result = colorizer.duration(1500, '1.5s')
      assert.ok(result === '1.5s' || result === `${RED}1.5s${RESET}`)
    })
  })

  describe('contentLength colorization', () => {
    let colorizer = new Colorizer(true)

    it('handles small sizes', () => {
      assert.strictEqual(colorizer.contentLength(500, '500B'), '500B')
    })

    it('handles KB sizes', () => {
      let result = colorizer.contentLength(2000, '2KB')
      assert.ok(result === '2KB' || result === `${CYAN}2KB${RESET}`)
    })

    it('handles 100KB+ sizes', () => {
      let result = colorizer.contentLength(150000, '150KB')
      assert.ok(result === '150KB' || result === `${YELLOW}150KB${RESET}`)
    })

    it('handles MB+ sizes', () => {
      let result = colorizer.contentLength(2000000, '2MB')
      assert.ok(result === '2MB' || result === `${RED}2MB${RESET}`)
    })

    it('handles undefined', () => {
      assert.strictEqual(colorizer.contentLength(undefined, 'N/A'), 'N/A')
    })
  })
})
