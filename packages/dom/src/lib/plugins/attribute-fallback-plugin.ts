import { definePlugin } from '@remix-run/reconciler'

type AttributeValue = true | string

export const attributeFallbackPlugin = definePlugin<Element>(() => ({
  keys: '*',
  setup() {
    let currentValues: null | Map<string, AttributeValue> = null
    let seenVersions: null | Map<string, number> = null
    let currentVersion = 0
    let commitKeys: string[] = []
    let commitValues: Array<null | AttributeValue> = []

    return {
      commit(input, node) {
        commitKeys.length = 0
        commitValues.length = 0
        for (let key in input.props) {
          commitKeys.push(key)
          commitValues.push(normalizeAttributeValue(input.props[key]))
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
          if (value === true) {
            node.setAttribute(key, '')
          } else {
            node.setAttribute(key, value)
          }
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

function normalizeAttributeValue(value: unknown): null | AttributeValue {
  if (value == null) return null
  if (value === false) return null
  if (typeof value === 'function') return null
  if (typeof value === 'object') return null
  if (value === true) return true
  return String(value)
}
