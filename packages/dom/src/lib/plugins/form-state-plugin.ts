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

export const formStatePlugin = definePlugin<Element>(() => ({
  keys: formStateKeys,
  phase: 'post',
  setup() {
    let current: null | Partial<Record<FormStateKey, unknown>> = null
    let hasCurrent = false

    return {
      commit(input, node) {
        let next: Partial<Record<FormStateKey, unknown>> | null = null
        for (let key of formStateKeys) {
          if (!(key in input.props)) continue
          if (!next) next = {}
          next[key] = input.props[key]
          delete input.props[key]
        }

        if (!current) current = {}

        for (let key of formStateKeys) {
          let hadKey = Object.prototype.hasOwnProperty.call(current, key)
          let nextHasKey = !!next && Object.prototype.hasOwnProperty.call(next, key)
          if (!nextHasKey) {
            if (!hadKey) continue
            resetProperty(node, key)
            delete current[key]
            hasCurrent = hasAnyOwnProperty(current)
            continue
          }

          let value = next ? next[key] : undefined
          if (value == null) {
            if (!hadKey) continue
            resetProperty(node, key)
            delete current[key]
            hasCurrent = hasAnyOwnProperty(current)
            continue
          }

          if (hadKey && current[key] === value) continue
          ;(node as unknown as Record<string, unknown>)[key] = value
          current[key] = value
          hasCurrent = true
        }

      },
      remove(node, reason) {
        if (reason === 'unmount') return
        if (!current || !hasCurrent) return
        for (let key of formStateKeys) {
          if (!Object.prototype.hasOwnProperty.call(current, key)) continue
          resetProperty(node, key)
        }
        current = null
        hasCurrent = false
      },
    }
  },
}))

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

function hasAnyOwnProperty(value: object) {
  for (let key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) return true
  }
  return false
}
