import { createMixin } from '@remix-run/reconciler'
import type { DomElementType } from '../jsx/jsx-runtime.ts'
import { getDomHostInput } from '../dom-node-policy.ts'

type AnimateKeyframes = Parameters<Element['animate']>[0]
type AnimateTiming = Parameters<Element['animate']>[1]

export type AnimateEntranceOptions = {
  initial?: boolean
  keyframes?: AnimateKeyframes
  options?: AnimateTiming
}

export type AnimateExitOptions = {
  keyframes?: AnimateKeyframes
  options?: AnimateTiming
}

let defaultEnterDefinition: Keyframe = { opacity: 0 }
let defaultExitDefinition: Keyframe = { opacity: 0 }
let presenceByNode = new WeakMap<
  HTMLElement,
  { animation: Animation; direction: 'enter' | 'exit' }
>()
let seenEntranceByParent = new WeakMap<Node, Map<string, Set<unknown>>>()

export let animateEntrance = createMixin<[options?: AnimateEntranceOptions], HTMLElement, DomElementType>(
  (handle) => {
  let activeNode: null | HTMLElement = null
  let latestOptions: AnimateEntranceOptions | undefined = undefined
  let hasPlayedInitialEnter = false

  handle.queueTask((node) => {
    if (!(node instanceof HTMLElement)) return
    activeNode = node
  })

  return (options, props) => {
    latestOptions = options
    handle.queueTask((node, signal) => {
      if (signal.aborted) return
      if (!(node instanceof HTMLElement)) return
      activeNode = node

      let presence = presenceByNode.get(node)
      if (presence?.direction === 'exit' && isAnimationActive(presence.animation)) {
        presence.animation.reverse()
        presenceByNode.set(node, { animation: presence.animation, direction: 'enter' })
        hasPlayedInitialEnter = true
        return
      }
      if (presence?.direction === 'enter' && isAnimationActive(presence.animation)) {
        hasPlayedInitialEnter = true
        return
      }
      if (hasPlayedInitialEnter) return

      if (latestOptions?.initial === false) {
        let hostInput = getDomHostInput(node)
        let parent = node.parentNode
        if (parent) {
          let key = hostInput?.key ?? null
          let type = hostInput?.type ?? node.localName
          let hasSeen = didParentSeeEntrance(parent, type, key)
          if (!hasSeen) {
            hasPlayedInitialEnter = true
            return
          }
        }
      }

      hasPlayedInitialEnter = true

      let keyframes = createPresenceKeyframes(
        latestOptions?.keyframes,
        'enter',
        defaultEnterDefinition,
      )
      let optionsWithDefaults = withDefaultFill(latestOptions?.options, 'backwards')
      let animation = node.animate(keyframes, optionsWithDefaults)
      presenceByNode.set(node, { animation, direction: 'enter' })
      attachPresenceCleanup(node, animation)
    })
    return <handle.element {...props} />
  }
  },
)

export let animateExit = createMixin<[options?: AnimateExitOptions], HTMLElement, DomElementType>(
  (handle) => {
  let activeNode: null | HTMLElement = null
  let latestOptions: AnimateExitOptions | undefined = undefined

  handle.addEventListener('detach', (event) => {
    if (!activeNode) return

    let presence = presenceByNode.get(activeNode)
    if (presence?.direction === 'enter' && isAnimationActive(presence.animation)) {
      event.retain()
      presence.animation.reverse()
      presenceByNode.set(activeNode, { animation: presence.animation, direction: 'exit' })
      event.waitUntil(finishedPromise(presence.animation))
      return
    }
    if (presence?.direction === 'exit' && isAnimationActive(presence.animation)) {
      event.waitUntil(finishedPromise(presence.animation))
      return
    }

    event.retain()
    let keyframes = createPresenceKeyframes(latestOptions?.keyframes, 'exit', defaultExitDefinition)
    let optionsWithDefaults = withDefaultFill(latestOptions?.options, 'forwards')
    let animation = activeNode.animate(keyframes, optionsWithDefaults)
    presenceByNode.set(activeNode, { animation, direction: 'exit' })
    attachPresenceCleanup(activeNode, animation)
    event.waitUntil(finishedPromise(animation))
  })

  handle.addEventListener('remove', () => {
    if (!activeNode) return
    let presence = presenceByNode.get(activeNode)
    if (!presence) return
    presenceByNode.delete(activeNode)
  })

  return (options, props) => {
    latestOptions = options
    handle.queueTask((node) => {
      if (!(node instanceof HTMLElement)) return
      activeNode = node
      let presence = presenceByNode.get(node)
      if (presence?.direction === 'exit' && isAnimationActive(presence.animation)) {
        presence.animation.reverse()
        presenceByNode.set(node, { animation: presence.animation, direction: 'enter' })
      }
    })
    return <handle.element {...props} />
  }
  },
)

function createPresenceKeyframes(
  definition: AnimateKeyframes | undefined,
  direction: 'enter' | 'exit',
  fallback: Keyframe,
): Keyframe[] {
  let edge =
    resolveDefinitionKeyframe(definition, direction === 'enter' ? 'start' : 'end') ?? fallback
  if (direction === 'enter') return [edge, {}]
  return [{}, edge]
}

function resolveDefinitionKeyframe(
  definition: AnimateKeyframes | undefined,
  edge: 'start' | 'end',
): null | Keyframe {
  if (definition == null) return null
  if (Array.isArray(definition)) {
    if (definition.length === 0) return null
    let index = edge === 'start' ? 0 : definition.length - 1
    return (definition[index] ?? null) as null | Keyframe
  }
  if (typeof definition !== 'object') return null
  let keyframe: Keyframe = {}
  for (let key in definition as Record<string, unknown>) {
    let value = (definition as Record<string, unknown>)[key]
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      let valueIndex = edge === 'start' ? 0 : value.length - 1
      keyframe[key] = value[valueIndex] as string | number | null
      continue
    }
    keyframe[key] = value as string | number | null
  }
  return keyframe
}

function withDefaultFill(options: AnimateTiming | undefined, fill: FillMode): AnimateTiming {
  if (typeof options === 'number') return options
  if (options == null) return { fill }
  return { ...options, fill: options.fill ?? fill }
}

function isAnimationActive(animation: Animation) {
  return animation.playState === 'running'
}

function attachPresenceCleanup(node: Element, animation: Animation) {
  let clearIfCurrent = () => {
    if (!(node instanceof HTMLElement)) return
    let current = presenceByNode.get(node)
    if (!current || current.animation !== animation) return
    presenceByNode.delete(node)
  }
  animation.addEventListener('finish', clearIfCurrent)
  animation.addEventListener('cancel', clearIfCurrent)
}

function finishedPromise(animation: Animation) {
  let finished = (animation as Animation & { finished?: Promise<unknown> }).finished
  if (finished) return finished.catch(() => {})
  return new Promise<void>((resolve) => {
    let done = () => {
      animation.removeEventListener('finish', done)
      animation.removeEventListener('cancel', done)
      resolve()
    }
    animation.addEventListener('finish', done)
    animation.addEventListener('cancel', done)
  })
}

function didParentSeeEntrance(parent: Node, type: string, key: unknown) {
  let byType = seenEntranceByParent.get(parent)
  if (!byType) {
    byType = new Map()
    seenEntranceByParent.set(parent, byType)
  }
  let seenKeys = byType.get(type)
  if (!seenKeys) {
    seenKeys = new Set()
    byType.set(type, seenKeys)
  }
  let seenBefore = seenKeys.has(key)
  if (!seenBefore) {
    seenKeys.add(key)
  }
  return seenBefore
}
