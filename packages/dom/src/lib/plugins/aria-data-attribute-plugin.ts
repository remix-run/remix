import { definePlugin } from '@remix-run/reconciler'

type AttrValue = string

export const ariaDataAttributePlugin = definePlugin<Element>(() => ({
  keys: '*',
  setup() {
    let currentValues: null | Map<string, AttrValue> = null
    let seenVersions: null | Map<string, number> = null
    let currentVersion = 0
    let commitKeys: string[] = []
    let commitValues: Array<null | AttrValue> = []

    return {
      commit(input, node) {
        commitKeys.length = 0
        commitValues.length = 0
        for (let key in input.props) {
          if (!key.startsWith('aria-') && !key.startsWith('data-')) continue
          commitKeys.push(key)
          commitValues.push(normalizeAttrValue(input.props[key], key))
          delete input.props[key]
        }

        if (!currentValues) currentValues = new Map()
        if (!seenVersions) seenVersions = new Map()
        currentVersion++

        for (let index = 0; index < commitKeys.length; index++) {
          let key = commitKeys[index]
          let value = commitValues[index]
          if (value === null) continue
          seenVersions.set(key, currentVersion)
          if (currentValues.get(key) === value) continue
          node.setAttribute(key, value)
          currentValues.set(key, value)
        }

        for (let [key] of currentValues) {
          if (seenVersions.get(key) === currentVersion) continue
          node.removeAttribute(key)
          currentValues.delete(key)
        }
      },
      remove(node, reason) {
        if (reason === 'unmount') return
        if (!currentValues || currentValues.size === 0) return
        for (let [key] of currentValues) {
          node.removeAttribute(key)
        }
        currentValues.clear()
        currentValues = null
        seenVersions?.clear()
        seenVersions = null
      },
    }
  },
}))

function normalizeAttrValue(value: unknown, key: string): null | AttrValue {
  if (value == null) return null
  // Match preact behavior where false is serialized for aria/data.
  if (value === false) return key.startsWith('data-') || key.startsWith('aria-') ? 'false' : null
  if (value === true) return 'true'
  return String(value)
}
