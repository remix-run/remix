import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { observeDeepProxy } from './observe-deep-proxy.ts'

describe('observeDeepProxy', () => {
  describe('primitives', () => {
    it('returns primitives unchanged', () => {
      let onChange = () => assert.fail('should not be called')
      assert.equal(observeDeepProxy('string', onChange), 'string')
      assert.equal(observeDeepProxy(42, onChange), 42)
      assert.equal(observeDeepProxy(true, onChange), true)
      assert.equal(observeDeepProxy(null, onChange), null)
      assert.equal(observeDeepProxy(undefined, onChange), undefined)
    })
  })

  describe('objects', () => {
    it('triggers onChange on property assignment', () => {
      let calls = 0
      let obj = observeDeepProxy({ name: 'test' }, () => calls++)
      assert.equal(calls, 0)

      obj.name = 'updated'

      assert.equal(calls, 1)
      assert.equal(obj.name, 'updated')
    })

    it('triggers onChange on new property assignment', () => {
      let calls = 0
      let obj = observeDeepProxy<Record<string, string>>({}, () => calls++)
      assert.equal(calls, 0)

      obj.newProp = 'value'

      assert.equal(calls, 1)
      assert.equal(obj.newProp, 'value')
    })

    it('triggers onChange on nested property assignment', () => {
      let calls = 0
      let obj = observeDeepProxy({ nested: { value: 1 } }, () => calls++)
      assert.equal(calls, 0)

      obj.nested.value = 2

      assert.equal(calls, 1)
      assert.equal(obj.nested.value, 2)
    })

    it('binds methods to original object for private field access', () => {
      class TestClass {
        #private = 'secret'
        getPrivate() {
          return this.#private
        }
      }

      let obj = observeDeepProxy(new TestClass(), () => {})

      // Private field access still works through the proxy
      assert.equal(obj.getPrivate(), 'secret')
    })

    it('triggers onChange for own methods except ignored ones (get, has, toString, etc.)', () => {
      class MockCookie {
        #map = new Map<string, string>()
        set(name: string, value: string) {
          this.#map.set(name, value)
        }
        get(name: string) {
          return this.#map.get(name)
        }
        has(name: string) {
          return this.#map.has(name)
        }
        delete(name: string) {
          this.#map.delete(name)
        }
        clear() {
          this.#map.clear()
        }
        toString() {
          return [...this.#map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
        }
      }

      let calls = 0
      let cookie = observeDeepProxy(new MockCookie(), () => calls++)
      assert.equal(calls, 0)

      // Mutating methods trigger onChange
      cookie.set('name', 'value')
      assert.equal(calls, 1)

      cookie.delete('name')
      assert.equal(calls, 2)

      cookie.clear()
      assert.equal(calls, 3)

      // Read-only methods do NOT trigger onChange (perf optimization)
      cookie.set('foo', 'bar')
      assert.equal(calls, 4)

      cookie.get('foo')
      assert.equal(calls, 4) // no change

      cookie.has('foo')
      assert.equal(calls, 4) // no change

      cookie.toString()
      assert.equal(calls, 4) // no change
    })
  })

  describe('arrays', () => {
    it('triggers onChange on push', () => {
      let calls = 0
      let arr = observeDeepProxy([1, 2, 3], () => calls++)
      assert.equal(calls, 0)

      arr.push(4)

      assert.equal(calls, 1)
      assert.deepEqual([...arr], [1, 2, 3, 4])
    })

    it('triggers onChange on pop', () => {
      let calls = 0
      let arr = observeDeepProxy([1, 2, 3], () => calls++)
      assert.equal(calls, 0)

      let popped = arr.pop()

      assert.equal(calls, 1)
      assert.equal(popped, 3)
      assert.deepEqual([...arr], [1, 2])
    })

    it('triggers onChange on shift', () => {
      let calls = 0
      let arr = observeDeepProxy([1, 2, 3], () => calls++)
      assert.equal(calls, 0)

      let shifted = arr.shift()

      assert.equal(calls, 1)
      assert.equal(shifted, 1)
      assert.deepEqual([...arr], [2, 3])
    })

    it('triggers onChange on unshift', () => {
      let calls = 0
      let arr = observeDeepProxy([1, 2, 3], () => calls++)
      assert.equal(calls, 0)

      arr.unshift(0)

      assert.equal(calls, 1)
      assert.deepEqual([...arr], [0, 1, 2, 3])
    })

    it('triggers onChange on splice', () => {
      let calls = 0
      let arr = observeDeepProxy([1, 2, 3], () => calls++)
      assert.equal(calls, 0)

      arr.splice(1, 1, 10, 20)

      assert.equal(calls, 1)
      assert.deepEqual([...arr], [1, 10, 20, 3])
    })

    it('triggers onChange on sort', () => {
      let calls = 0
      let arr = observeDeepProxy([3, 1, 2], () => calls++)
      assert.equal(calls, 0)

      arr.sort()

      assert.equal(calls, 1)
      assert.deepEqual([...arr], [1, 2, 3])
    })

    it('triggers onChange on reverse', () => {
      let calls = 0
      let arr = observeDeepProxy([1, 2, 3], () => calls++)
      assert.equal(calls, 0)

      arr.reverse()

      assert.equal(calls, 1)
      assert.deepEqual([...arr], [3, 2, 1])
    })

    it('triggers onChange on index assignment', () => {
      let calls = 0
      let arr = observeDeepProxy([1, 2, 3], () => calls++)
      assert.equal(calls, 0)

      arr[1] = 10

      assert.equal(calls, 1)
      assert.deepEqual([...arr], [1, 10, 3])
    })

    it('triggers onChange on length assignment', () => {
      let calls = 0
      let arr = observeDeepProxy([1, 2, 3], () => calls++)
      assert.equal(calls, 0)

      arr.length = 1

      assert.equal(calls, 1)
      assert.deepEqual([...arr], [1])
    })

    it('triggers onChange on nested object mutation within array', () => {
      let calls = 0
      let arr = observeDeepProxy([{ value: 1 }, { value: 2 }], () => calls++)
      assert.equal(calls, 0)

      arr[0].value = 10

      assert.equal(calls, 1)
      assert.equal(arr[0].value, 10)
    })
  })

  describe('Map', () => {
    it('triggers onChange on set', () => {
      let calls = 0
      let map = observeDeepProxy(new Map<string, number>(), () => calls++)
      assert.equal(calls, 0)

      map.set('key', 1)

      assert.equal(calls, 1)
      assert.equal(map.get('key'), 1)
    })

    it('triggers onChange on delete', () => {
      let calls = 0
      let map = observeDeepProxy(new Map([['key', 1]]), () => calls++)
      assert.equal(calls, 0)

      map.delete('key')

      assert.equal(calls, 1)
      assert.equal(map.has('key'), false)
    })

    it('triggers onChange on clear', () => {
      let calls = 0
      let map = observeDeepProxy(
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
        () => calls++,
      )
      assert.equal(calls, 0)

      map.clear()

      assert.equal(calls, 1)
      assert.equal(map.size, 0)
    })

    it('does not trigger onChange on get', () => {
      let calls = 0
      let map = observeDeepProxy(new Map([['key', 1]]), () => calls++)
      assert.equal(calls, 0)

      map.get('key')

      assert.equal(calls, 0)
    })
  })

  describe('Set', () => {
    it('triggers onChange on add', () => {
      let calls = 0
      let set = observeDeepProxy(new Set<string>(), () => calls++)
      assert.equal(calls, 0)

      set.add('value')

      assert.equal(calls, 1)
      assert.ok(set.has('value'))
    })

    it('triggers onChange on delete', () => {
      let calls = 0
      let set = observeDeepProxy(new Set(['value']), () => calls++)
      assert.equal(calls, 0)

      set.delete('value')

      assert.equal(calls, 1)
      assert.ok(!set.has('value'))
    })

    it('triggers onChange on clear', () => {
      let calls = 0
      let set = observeDeepProxy(new Set(['a', 'b']), () => calls++)
      assert.equal(calls, 0)

      set.clear()

      assert.equal(calls, 1)
      assert.equal(set.size, 0)
    })
  })

  describe('iteration', () => {
    it('allows iterating over observed arrays', () => {
      let arr = observeDeepProxy([1, 2, 3], () => {})
      let sum = 0
      for (let val of arr) {
        sum += val
      }
      assert.equal(sum, 6)
    })

    it('allows iterating over observed Maps', () => {
      let map = observeDeepProxy(
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
        () => {},
      )
      let keys: string[] = []
      for (let [key] of map) {
        keys.push(key)
      }
      assert.deepEqual(keys, ['a', 'b'])
    })

    it('allows iterating over observed Sets', () => {
      let set = observeDeepProxy(new Set(['a', 'b']), () => {})
      let values: string[] = []
      for (let val of set) {
        values.push(val)
      }
      assert.deepEqual(values, ['a', 'b'])
    })
  })
})
