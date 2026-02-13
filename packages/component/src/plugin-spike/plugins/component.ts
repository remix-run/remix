import { definePlugin } from '../types.ts'
import type { ElementType, RemixElement } from '../../lib/jsx.ts'
import type { Handle } from '../types.ts'

type ComponentFactory = (handle: Handle) => (props: Record<string, unknown>) => unknown

export const component = definePlugin(() => (nodeHandle) => {
  let currentType: null | ElementType = null
  let render: null | ((props: Record<string, unknown>) => unknown) = null
  let handle: Handle = {
    update: nodeHandle.update,
    queueTask(task) {
      nodeHandle.queueTask((_node, signal) => task(signal))
    },
    get signal() {
      return nodeHandle.signal
    },
  }

  return (input) => {
    if (typeof input.type !== 'function') return input

    if (!render || currentType !== input.type) {
      let setup = (input.type as ComponentFactory)(handle)
      if (typeof setup !== 'function') {
        throw new Error('component factory must return a render function')
      }
      currentType = input.type
      render = setup
    }

    let next = render(input.props)
    let element = toRemixElement(next)
    return {
      type: element.type,
      props: element.props ?? {},
    }
  }
})

function toRemixElement(value: unknown): RemixElement {
  if (isRemixElement(value)) return value
  throw new Error('component render must return a jsx() element')
}

function isRemixElement(value: unknown): value is RemixElement {
  if (!value || typeof value !== 'object') return false
  return (value as { $rmx?: boolean }).$rmx === true
}
