import { definePlugin } from '../types.ts'

type ReflectedProp = 'checked' | 'selected' | 'value'

let reflectedProps: ReflectedProp[] = ['value', 'checked', 'selected']

export const reflectedPropsPlugin = definePlugin(() => (host) => {
  let current = new Set<ReflectedProp>()

  return (input) => {
    let next = new Map<ReflectedProp, unknown>()
    for (let key of reflectedProps) {
      if (!(key in input.props)) continue
      next.set(key, input.props[key])
      delete input.props[key]
    }

    if (next.size === 0 && current.size === 0) return input

    host.queueTask((node) => {
      for (let key of current) {
        if (next.has(key)) continue
        resetReflected(node, key)
      }

      for (let [key, value] of next) {
        if (value == null) {
          resetReflected(node, key)
        } else {
          setReflected(node, key, value)
        }
      }

      current = new Set(next.keys())
    })

    return input
  }
})

function setReflected(node: Element, key: ReflectedProp, value: unknown) {
  let element = node as unknown as Record<string, unknown>
  element[key] = value
}

function resetReflected(node: Element, key: ReflectedProp) {
  let element = node as unknown as Record<string, unknown>
  switch (key) {
    case 'value':
      element.value = ''
      return
    case 'checked':
    case 'selected':
      element[key] = false
      return
  }
}
