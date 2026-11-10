interface DescriptorRestoration {
  object: object
  propertyName: PropertyKey
  descriptor: PropertyDescriptor | undefined
  isRestored(): boolean
}

type DescriptorSlot = 'value' | 'get' | 'set'

const descriptors = new WeakMap<
  object,
  { slot: DescriptorSlot; restoration: DescriptorRestoration }
>()
const getDescriptor = descriptors.get.bind(descriptors)
const setDescriptor = descriptors.set.bind(descriptors)
const defineProperty = Object.defineProperty
const deleteProperty = Reflect.deleteProperty

export function registerMockDescriptor(
  fn: object,
  slot: DescriptorSlot,
  restoration: DescriptorRestoration,
): void {
  setDescriptor(fn, { slot, restoration })
}

export function restoreMockDescriptor(
  object: object,
  propertyName: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): PropertyDescriptor | undefined {
  let current = descriptor
  while (current) {
    let previous: DescriptorRestoration | undefined
    for (let slot of ['value', 'get', 'set'] as const) {
      let fn = current[slot]
      if (typeof fn !== 'function') continue
      let candidate = getDescriptor(fn)
      let restoration = candidate?.restoration
      if (
        candidate?.slot === slot &&
        restoration?.object === object &&
        restoration.propertyName === propertyName &&
        restoration.isRestored()
      ) {
        previous = restoration
        break
      }
    }
    if (!previous) break
    current = previous.descriptor
  }
  if (current) {
    defineProperty(object, propertyName, current)
  } else if (!deleteProperty(object, propertyName)) {
    throw new TypeError('Unable to restore the property')
  }
  return current
}
