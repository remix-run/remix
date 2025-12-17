/**
 * Deep observation utility for Bun compatibility.
 *
 * Wraps objects, arrays, Maps, and Sets in Proxies that call `onChange`
 * whenever a mutation occurs. This allows SuperHeaders to sync mutations
 * to native Headers storage in Bun.
 *
 * @example
 * let obj = observeDeepProxy({ name: 'test' }, () => console.log('changed!'))
 * obj.name = 'updated' // logs: changed!
 *
 * let arr = observeDeepProxy([1, 2, 3], () => console.log('changed!'))
 * arr.push(4) // logs: changed!
 *
 * let map = observeDeepProxy(new Map(), () => console.log('changed!'))
 * map.set('key', 'value') // logs: changed!
 */

type OnChange = () => void

let ARRAY_MUTATORS = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
]
let MAP_MUTATORS = ['set', 'delete', 'clear']
let SET_MUTATORS = ['add', 'delete', 'clear']

// Read-only methods that shouldn't trigger onChange (perf optimization).
// toString is required in the ignore list since it's called in the onChange handler.
let OBJECT_IGNORE_METHODS = new Set([
  'toString',
  'get',
  'has',
  'entries',
  'keys',
  'values',
  'forEach',
])

export function observeDeepProxy<T>(value: T, onChange: OnChange): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (value instanceof Map) {
    return createCollectionProxy(value, MAP_MUTATORS, onChange) as T
  }

  if (value instanceof Set) {
    return createCollectionProxy(value, SET_MUTATORS, onChange) as T
  }

  if (Array.isArray(value)) {
    return createArrayProxy(value, onChange) as T
  }

  return createObjectProxy(value, onChange) as T
}

function createCollectionProxy<T extends Map<any, any> | Set<any>>(
  target: T,
  mutators: string[],
  onChange: OnChange,
): T {
  return new Proxy(target, {
    get(target, prop) {
      let value = Reflect.get(target, prop, target)
      if (typeof value === 'function') {
        if (mutators.includes(prop as string)) {
          return (...args: any[]) => {
            let result = value.apply(target, args)
            onChange()
            return result
          }
        }
        return value.bind(target)
      }
      return value
    },
  })
}

function createArrayProxy<T extends any[]>(target: T, onChange: OnChange): T {
  return new Proxy(target, {
    get(target, prop) {
      let value = Reflect.get(target, prop)
      if (typeof value === 'function') {
        if (ARRAY_MUTATORS.includes(prop as string)) {
          return (...args: any[]) => {
            let result = value.apply(target, args)
            onChange()
            return result
          }
        }
        return value.bind(target)
      }
      // Recursively observe nested objects accessed by index
      if (
        typeof prop === 'string' &&
        !isNaN(Number(prop)) &&
        typeof value === 'object' &&
        value !== null
      ) {
        return observeDeepProxy(value, onChange)
      }
      return value
    },
    set(target, prop, newValue) {
      ;(target as any)[prop] = newValue
      onChange()
      return true
    },
  })
}

function createObjectProxy<T extends object>(target: T, onChange: OnChange): T {
  return new Proxy(target, {
    get(target, prop) {
      let value = Reflect.get(target, prop, target)
      if (typeof value === 'function') {
        // Skip inherited Object.prototype methods (not defined on the class)
        if (typeof prop === 'symbol' || !Object.hasOwn(Object.getPrototypeOf(target), prop)) {
          return value.bind(target)
        }
        // Wrap methods to trigger onChange, except known read-only methods (perf)
        if (OBJECT_IGNORE_METHODS.has(prop)) {
          return value.bind(target)
        }
        return (...args: any[]) => {
          let result = value.apply(target, args)
          onChange()
          return result
        }
      }
      // Recursively observe nested objects/arrays
      if (typeof value === 'object' && value !== null) {
        return observeDeepProxy(value, onChange)
      }
      return value
    },
    set(target: any, prop, newValue) {
      target[prop] = newValue
      onChange()
      return true
    },
  })
}
