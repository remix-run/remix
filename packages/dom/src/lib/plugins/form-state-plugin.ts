import { definePlugin } from '@remix-run/reconciler'

type FormStateKey =
  | 'checked'
  | 'defaultChecked'
  | 'defaultValue'
  | 'selected'
  | 'selectedIndex'
  | 'value'

const formStateKeys: FormStateKey[] = [
  'value',
  'checked',
  'selected',
  'defaultValue',
  'defaultChecked',
  'selectedIndex',
]

export const formStatePlugin = definePlugin<Element>(() => (host) => {
  let current = new Set<FormStateKey>()

  return (input) => {
    let next = new Map<FormStateKey, unknown>()
    for (let key of formStateKeys) {
      if (!(key in input.props)) continue
      next.set(key, input.props[key])
      delete input.props[key]
    }

    if (next.size === 0 && current.size === 0) return input

    host.queueTask((node) => {
      for (let key of current) {
        if (next.has(key)) continue
        resetProperty(node, key)
      }
      for (let [key, value] of next) {
        if (value == null) {
          resetProperty(node, key)
        } else {
          ;(node as unknown as Record<string, unknown>)[key] = value
        }
      }
      current = new Set(next.keys())
    })

    return input
  }
})

function resetProperty(node: Element, key: FormStateKey) {
  let target = node as unknown as Record<string, unknown>
  switch (key) {
    case 'value':
    case 'defaultValue':
      target[key] = ''
      return
    case 'selectedIndex':
      target.selectedIndex = -1
      return
    case 'checked':
    case 'defaultChecked':
    case 'selected':
      target[key] = false
      return
  }
}
