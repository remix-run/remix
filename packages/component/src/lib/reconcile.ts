import { createContainer } from '@remix-run/interaction'
import type { Component, ComponentHandle, FrameHandle } from './component.ts'
import { createComponent, Frame } from './component.ts'
import type {
  ComponentNode,
  CommittedComponentNode,
  CommittedHostNode,
  CommittedTextNode,
  FragmentNode,
  HostNode,
  TextNode,
  VNode,
  VNodeType,
} from './vnode.ts'
import {
  isCommittedComponentNode,
  isComponentNode,
  isCommittedHostNode,
  isCommittedTextNode,
  isFragmentNode,
  isHostNode,
  isTextNode,
  findContextFromAncestry,
} from './vnode.ts'
import { invariant } from './invariant.ts'
import { diffHostProps, cleanupCssProps } from './diff-props.ts'
import { skipComments, logHydrationMismatch } from './hydration.ts'
import type { Scheduler } from './scheduler.ts'
import { toVNode } from './to-vnode.ts'
import {
  findMatchingExitingNode,
  getPresenceConfig,
  markNodeExiting,
  playEnterAnimation,
  playExitAnimation,
  shouldPlayEnterAnimation,
  unmarkNodeExiting,
} from './presence.ts'
import {
  registerLayoutElement,
  unregisterLayoutElement,
  updateLayoutElement,
} from './layout-animation.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

// Internal diffing flags (modeled after Preact)
const INSERT_VNODE = 1 << 0
const MATCHED = 1 << 1

let fixmeIdCounter = 0

// Compute SVG context for a node based on its parent and type.
// Returns true if the node is within an SVG subtree, false otherwise.
function getSvgContext(vParent: VNode, nodeType: VNodeType): boolean {
  // Only host elements (strings) can affect SVG context
  if (typeof nodeType === 'string') {
    // svg element creates SVG context
    if (nodeType === 'svg') return true
    // foreignObject switches back to HTML context
    if (nodeType === 'foreignObject') return false
  }
  // Otherwise inherit from parent
  return vParent._svg ?? false
}

export function diffVNodes(
  curr: VNode | null,
  next: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
  rootCursor?: Node | null,
): Node | null | undefined {
  next._parent = vParent // set parent for initial render context lookups
  next._svg = getSvgContext(vParent, next.type)

  // new
  if (curr === null) {
    return insert(next, domParent, frame, scheduler, vParent, rootTarget, anchor, rootCursor)
  }

  if (curr.type !== next.type) {
    replace(curr, next, domParent, frame, scheduler, vParent, rootTarget, anchor)
    return rootCursor
  }

  if (isCommittedTextNode(curr) && isTextNode(next)) {
    diffText(curr, next, vParent)
    return rootCursor
  }

  if (isCommittedHostNode(curr) && isHostNode(next)) {
    diffHost(curr, next, frame, scheduler, vParent, rootTarget)
    return rootCursor
  }

  if (isCommittedComponentNode(curr) && isComponentNode(next)) {
    diffComponent(curr, next, frame, scheduler, domParent, vParent, rootTarget)
    return rootCursor
  }

  if (isFragmentNode(curr) && isFragmentNode(next)) {
    diffChildren(
      curr._children,
      next._children,
      domParent,
      frame,
      scheduler,
      vParent,
      rootTarget,
      undefined,
      anchor,
    )
    return rootCursor
  }

  if (curr.type === Frame && next.type === Frame) {
    throw new Error('TODO: Frame diff not implemented')
  }

  invariant(false, 'Unexpected diff case')
}

function replace(
  curr: VNode,
  next: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
) {
  // Use curr's DOM position (most accurate), fall back to anchor if curr has no DOM
  anchor = findFirstDomAnchor(curr) || anchor
  insert(next, domParent, frame, scheduler, vParent, rootTarget, anchor)
  remove(curr, domParent, scheduler)
}

function diffHost(
  curr: CommittedHostNode,
  next: HostNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
) {
  // Handle innerHTML prop BEFORE diffChildren to avoid clearing children
  if (next.props.innerHTML != null) {
    // innerHTML is set, update it if changed
    if (curr.props.innerHTML !== next.props.innerHTML) {
      curr._dom.innerHTML = next.props.innerHTML
    }
  } else if (curr.props.innerHTML != null) {
    // innerHTML was removed, clear it before adding children
    curr._dom.innerHTML = ''
  }

  diffChildren(curr._children, next._children, curr._dom, frame, scheduler, next, rootTarget)
  diffHostProps(curr.props, next.props, curr._dom)

  next._dom = curr._dom
  next._parent = vParent
  next._controller = curr._controller

  let nextOn = next.props.on
  if (nextOn) {
    if (curr._events) {
      // Update existing container
      next._events = curr._events
      let eventsContainer = curr._events
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)])
    } else {
      // Create new container
      let eventsContainer = createContainer(curr._dom)
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)])
      next._events = eventsContainer
    }
  } else if (curr._events) {
    // Dispose old container since next has no on prop
    let eventsContainer = curr._events
    scheduler.enqueueTasks([() => eventsContainer.dispose()])
  }
  // If neither has on, do nothing - no _events to set

  // Update layout animation registration
  let nextPresenceConfig = getPresenceConfig(next)
  let currPresenceConfig = getPresenceConfig(curr)
  if (nextPresenceConfig?.layout) {
    updateLayoutElement(curr._dom, nextPresenceConfig.layout)
  } else if (currPresenceConfig?.layout) {
    unregisterLayoutElement(curr._dom)
  }

  return
}

function setupHostNode(node: HostNode, dom: Element, scheduler: Scheduler): void {
  node._dom = dom

  let on = node.props.on
  if (on) {
    let eventsContainer = createContainer(dom)
    scheduler.enqueueTasks([() => eventsContainer.set(on)])
    node._events = eventsContainer
  }

  let connect = node.props.connect
  let presenceConfig = getPresenceConfig(node)
  let playEnter = shouldPlayEnterAnimation(presenceConfig?.enter)

  // Register for layout animations if configured
  if (presenceConfig?.layout) {
    registerLayoutElement(dom, presenceConfig.layout)
  }

  // Schedule connect callback first, then enter animation plays after
  if (connect) {
    // Only create controller if connect callback expects a signal (length >= 2)
    if (connect.length >= 2) {
      let controller = new AbortController()
      node._controller = controller
      scheduler.enqueueTasks([
        () => {
          connect(dom, controller.signal)
          // Play enter animation after connect
          if (playEnter) {
            playEnterAnimation(node as CommittedHostNode, presenceConfig!.enter!)
          }
        },
      ])
    } else {
      scheduler.enqueueTasks([
        () => {
          connect(dom)
          // Play enter animation after connect
          if (playEnter) {
            playEnterAnimation(node as CommittedHostNode, presenceConfig!.enter!)
          }
        },
      ])
    }
  } else if (playEnter) {
    // No connect, but has animate - play enter animation
    scheduler.enqueueTasks([
      () => {
        playEnterAnimation(node as CommittedHostNode, presenceConfig!.enter!)
      },
    ])
  }
}

function diffText(curr: CommittedTextNode, next: TextNode, vParent: VNode) {
  if (curr._text !== next._text) {
    curr._dom.textContent = next._text
  }
  next._dom = curr._dom
  next._parent = vParent
}

function insert(
  node: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  node._parent = vParent // set parent for initial render context lookups
  node._svg = getSvgContext(vParent, node.type)

  // Stop hydration if cursor has reached the anchor (end boundary)
  // Check BEFORE skipComments to prevent escaping range root markers
  if (cursor && anchor && cursor === anchor) {
    cursor = null
  }

  cursor = skipComments(cursor ?? null)

  // Also check after skipComments in case we skipped past the anchor
  if (cursor && anchor && cursor === anchor) {
    cursor = null
  }

  let doInsert = anchor
    ? (dom: Node) => domParent.insertBefore(dom, anchor)
    : (dom: Node) => domParent.appendChild(dom)

  if (isTextNode(node)) {
    if (cursor instanceof Text) {
      node._parent = vParent
      // Handle text node consolidation: server renders adjacent text as single node
      // e.g., <span>Hello {world}</span> → server: "Hello world", client: ["Hello ", "world"]
      if (cursor.data !== node._text) {
        if (cursor.data.startsWith(node._text) && node._text.length < cursor.data.length) {
          // Consolidation case: split the text node at the boundary
          // cursor becomes the first part (node._text), remainder is returned for next vnode
          let remainder = cursor.splitText(node._text.length)
          node._dom = cursor
          return remainder
        }
        // Genuine mismatch - correct it
        logHydrationMismatch('text mismatch', cursor.data, node._text)
        cursor.data = node._text
      }
      node._dom = cursor
      return cursor.nextSibling
    }
    let dom = document.createTextNode(node._text)
    node._dom = dom
    node._parent = vParent
    doInsert(dom)
    return cursor
  }

  if (isHostNode(node)) {
    // Check for matching exiting node that can be reclaimed
    let exitingNode = findMatchingExitingNode(node.type, node.key, domParent)
    if (exitingNode) {
      reclaimExitingNode(exitingNode, node, domParent, frame, scheduler, vParent, rootTarget)
      return cursor
    }

    if (cursor instanceof Element) {
      // SVG elements have case-sensitive tag names (e.g. linearGradient, clipPath)
      // HTML elements are case-insensitive, so we lowercase for comparison
      let cursorTag = node._svg ? cursor.tagName : cursor.tagName.toLowerCase()
      if (cursorTag === node.type) {
        // FIXME: hydrate css prop
        // correct hydration mismatches
        diffHostProps({}, node.props, cursor)

        // Handle innerHTML prop
        if (node.props.innerHTML != null) {
          cursor.innerHTML = node.props.innerHTML
        } else {
          let childCursor = cursor.firstChild
          // Ignore excess nodes - browser extensions may inject content
          diffChildren(
            null,
            node._children,
            cursor,
            frame,
            scheduler,
            node,
            rootTarget,
            childCursor,
          )
        }

        setupHostNode(node, cursor, scheduler)
        return cursor.nextSibling
      } else {
        // Type mismatch - try single-advance retry to handle browser extension injections
        // at the start of containers. Skip this node and try the next sibling once.
        let nextSibling = skipComments(cursor.nextSibling)
        if (nextSibling instanceof Element) {
          let nextTag = node._svg ? nextSibling.tagName : nextSibling.tagName.toLowerCase()
          if (nextTag === node.type) {
            // Found a match after skipping - adopt it and leave skipped node in place
            diffHostProps({}, node.props, nextSibling)

            if (node.props.innerHTML != null) {
              nextSibling.innerHTML = node.props.innerHTML
            } else {
              let childCursor = nextSibling.firstChild
              diffChildren(
                null,
                node._children,
                nextSibling,
                frame,
                scheduler,
                node,
                rootTarget,
                childCursor,
              )
            }

            setupHostNode(node, nextSibling, scheduler)
            return nextSibling.nextSibling
          }
        }
        // Retry failed - log mismatch and create new element (don't remove mismatched nodes)
        logHydrationMismatch('tag', cursorTag, node.type)
        cursor = undefined // stop hydration for this tree
      }
    }
    let dom = node._svg
      ? document.createElementNS(SVG_NS, node.type)
      : document.createElement(node.type)
    diffHostProps({}, node.props, dom)

    // Handle innerHTML prop
    if (node.props.innerHTML != null) {
      dom.innerHTML = node.props.innerHTML
    } else {
      diffChildren(null, node._children, dom, frame, scheduler, node, rootTarget)
    }

    setupHostNode(node, dom, scheduler)
    doInsert(dom)
    return cursor
  }

  if (isFragmentNode(node)) {
    // Insert fragment children in order before the same anchor
    for (let child of node._children) {
      cursor = insert(child, domParent, frame, scheduler, vParent, rootTarget, anchor, cursor)
    }
    return cursor
  }

  if (isComponentNode(node)) {
    return diffComponent(
      null,
      node,
      frame,
      scheduler,
      domParent,
      vParent,
      rootTarget,
      anchor,
      cursor,
    )
  }

  if (node.type === Frame) {
    throw new Error('TODO: Frame insert not implemented')
  }

  invariant(false, 'Unexpected node type')
}

export function renderComponent(
  handle: ComponentHandle,
  currContent: VNode | null,
  next: ComponentNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  rootTarget: EventTarget,
  vParent?: VNode,
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  let [element, tasks] = handle.render(next.props)
  let content = toVNode(element)

  let newCursor = diffVNodes(
    currContent,
    content,
    domParent,
    frame,
    scheduler,
    next,
    rootTarget,
    anchor,
    cursor,
  )
  next._content = content
  next._handle = handle
  next._parent = vParent

  let committed = next as CommittedComponentNode

  handle.setScheduleUpdate(() => {
    scheduler.enqueue(committed, domParent)
  })

  scheduler.enqueueTasks(tasks)

  return newCursor
}

function diffComponent(
  curr: CommittedComponentNode | null,
  next: ComponentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  domParent: ParentNode,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  if (curr === null) {
    next._handle = createComponent({
      id: `e${++fixmeIdCounter}`,
      frame,
      type: next.type,
      getContext: (type: Component) => {
        return findContextFromAncestry(vParent, type)
      },
    })

    return renderComponent(
      next._handle,
      null,
      next,
      domParent,
      frame,
      scheduler,
      rootTarget,
      vParent,
      anchor,
      cursor,
    )
  }
  next._handle = curr._handle
  let { _content, _handle } = curr
  return renderComponent(
    _handle,
    _content,
    next,
    domParent,
    frame,
    scheduler,
    rootTarget,
    vParent,
    anchor,
    cursor,
  )
}

// Cleanup without DOM removal - used for descendants when parent DOM node is removed
function cleanupDescendants(node: VNode, scheduler: Scheduler): void {
  if (isCommittedTextNode(node)) {
    return
  }

  if (isCommittedHostNode(node)) {
    for (let child of node._children) {
      cleanupDescendants(child, scheduler)
    }

    cleanupCssProps(node.props)

    // Unregister from layout animations
    let presenceConfig = getPresenceConfig(node)
    if (presenceConfig?.layout) {
      unregisterLayoutElement(node._dom)
    }
    if (node._controller) node._controller.abort()
    let _events = node._events
    if (_events) {
      scheduler.enqueueTasks([() => _events.dispose()])
    }
    return
  }

  if (isFragmentNode(node)) {
    for (let child of node._children) {
      cleanupDescendants(child, scheduler)
    }
    return
  }

  if (isCommittedComponentNode(node)) {
    cleanupDescendants(node._content, scheduler)
    let tasks = node._handle.remove()
    scheduler.enqueueTasks(tasks)
    return
  }
}

export function remove(node: VNode, domParent: ParentNode, scheduler: Scheduler) {
  if (isCommittedTextNode(node)) {
    domParent.removeChild(node._dom)
    return
  }

  if (isCommittedHostNode(node)) {
    // Check if already exiting - do nothing
    if (node._exiting) {
      return
    }

    let presenceConfig = getPresenceConfig(node)

    // Only animate exit if there's an exit config defined
    if (presenceConfig?.exit) {
      let animation = node._animation

      // Check if enter animation is still running - reverse it instead of playing exit
      if (animation && animation.playState === 'running') {
        // Reverse the enter animation
        animation.reverse()
        markNodeExiting(node, domParent)

        // Use finished promise for more reliable completion handling
        animation.finished.then(() => {
          // Check if node was reclaimed while animating
          if (!node._exiting) return
          unmarkNodeExiting(node)
          node._animation = undefined
          performHostNodeRemoval(node, domParent, scheduler)
        })
        return
      }

      // Enter animation finished or doesn't exist - play exit animation
      playExitAnimation(node, presenceConfig.exit, domParent, () => {
        performHostNodeRemoval(node, domParent, scheduler)
      })
      return
    }

    // No exit animation config - remove immediately (cancel any running enter animation)
    if (node._animation) {
      node._animation.cancel()
      node._animation = undefined
    }
    performHostNodeRemoval(node, domParent, scheduler)
    return
  }

  if (isFragmentNode(node)) {
    for (let child of node._children) {
      remove(child, domParent, scheduler)
    }
    return
  }

  if (isCommittedComponentNode(node)) {
    remove(node._content, domParent, scheduler)
    let tasks = node._handle.remove()
    scheduler.enqueueTasks(tasks)
    return
  }
}

// Actually remove a host node from DOM and clean up
function performHostNodeRemoval(
  node: CommittedHostNode,
  domParent: ParentNode,
  scheduler: Scheduler,
) {
  // Clean up all descendants first (before removing DOM subtree)
  for (let child of node._children) {
    cleanupDescendants(child, scheduler)
  }

  cleanupCssProps(node.props)

  // Unregister from layout animations
  let presenceConfig = getPresenceConfig(node)
  if (presenceConfig?.layout) {
    unregisterLayoutElement(node._dom)
  }
  // Only remove if still in DOM (might have been removed by parent)
  if (node._dom.parentNode === domParent) {
    domParent.removeChild(node._dom)
  }
  if (node._controller) node._controller.abort()
  let _events = node._events
  if (_events) {
    scheduler.enqueueTasks([() => _events.dispose()])
  }
}

function diffChildren(
  curr: VNode[] | null,
  next: VNode[],
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
  cursor?: Node | null,
  anchor?: Node,
) {
  // Initial mount / hydration: delegate to insert() for each child so that
  // hydration cursors and creation logic remain centralized there.
  if (curr === null) {
    for (let node of next) {
      cursor = insert(node, domParent, frame, scheduler, vParent, rootTarget, anchor, cursor)
    }
    vParent._children = next
    return cursor
  }

  let currLength = curr.length
  let nextLength = next.length

  // Detect if any keys are present in the new children. If not, we can fall
  // back to the simpler index-based diff which is cheaper and matches
  // pre-existing behavior.
  let hasKeys = false
  for (let i = 0; i < nextLength; i++) {
    let node = next[i]
    if (node && node.key != null) {
      hasKeys = true
      break
    }
  }

  if (!hasKeys) {
    for (let i = 0; i < nextLength; i++) {
      let currentNode = i < currLength ? curr[i] : null
      diffVNodes(
        currentNode,
        next[i],
        domParent,
        frame,
        scheduler,
        vParent,
        rootTarget,
        anchor,
        cursor,
      )
    }

    if (currLength > nextLength) {
      for (let i = nextLength; i < currLength; i++) {
        let node = curr[i]
        if (node) remove(node, domParent, scheduler)
      }
    }

    vParent._children = next
    return
  }

  // --- O(n + m) keyed diff with Map-based lookup ------------------------------

  let oldChildren = curr
  let oldChildrenLength = currLength
  let remainingOldChildren = oldChildrenLength

  // Build key → index map for O(1) lookup: O(m)
  let oldKeyMap = new Map<string, number>()
  for (let i = 0; i < oldChildrenLength; i++) {
    let c = oldChildren[i]
    if (c) {
      c._flags = 0
      if (c.key != null) {
        oldKeyMap.set(c.key, i)
      }
    }
  }

  let skew = 0
  let newChildren: VNode[] = new Array(nextLength)

  // First pass: match new children to old ones using Map lookup: O(n)
  for (let i = 0; i < nextLength; i++) {
    let childVNode = next[i]
    if (!childVNode) {
      newChildren[i] = childVNode
      continue
    }

    newChildren[i] = childVNode
    childVNode._parent = vParent

    let skewedIndex = i + skew
    let matchingIndex = -1

    let key = childVNode.key
    let type = childVNode.type

    if (key != null) {
      // O(1) Map lookup for keyed children
      let mapIndex = oldKeyMap.get(key)
      if (mapIndex !== undefined) {
        let candidate = oldChildren[mapIndex]
        let candidateFlags = candidate?._flags ?? 0
        if (candidate && (candidateFlags & MATCHED) === 0 && candidate.type === type) {
          matchingIndex = mapIndex
        }
      }
    } else {
      // Non-keyed children use positional identity only - no searching
      let searchVNode = oldChildren[skewedIndex]
      let searchFlags = searchVNode?._flags ?? 0
      let available = searchVNode != null && (searchFlags & MATCHED) === 0
      if (available && searchVNode.key == null && type === searchVNode.type) {
        matchingIndex = skewedIndex
      }
    }

    childVNode._index = matchingIndex

    let matchedOldVNode: VNode | null = null
    if (matchingIndex !== -1) {
      matchedOldVNode = oldChildren[matchingIndex]
      remainingOldChildren--
      if (matchedOldVNode) {
        matchedOldVNode._flags = (matchedOldVNode._flags ?? 0) | MATCHED
      }
    }

    // Determine whether this is a mount vs move and mark INSERT_VNODE
    let oldDom = matchedOldVNode && findFirstDomAnchor(matchedOldVNode)
    let isMounting = !matchedOldVNode || !oldDom
    if (isMounting) {
      if (matchingIndex === -1) {
        // Adjust skew similar to Preact when lengths differ
        if (nextLength > oldChildrenLength) {
          skew--
        } else if (nextLength < oldChildrenLength) {
          skew++
        }
      }

      childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE
    } else if (matchingIndex !== i + skew) {
      if (matchingIndex === i + skew - 1) {
        skew--
      } else if (matchingIndex === i + skew + 1) {
        skew++
      } else {
        if (matchingIndex! > i + skew) skew--
        else skew++
        childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE
      }
    }
  }

  // Unmount any old children that weren't matched
  if (remainingOldChildren) {
    for (let i = 0; i < oldChildrenLength; i++) {
      let oldVNode = oldChildren[i]
      if (oldVNode && ((oldVNode._flags ?? 0) & MATCHED) === 0) {
        remove(oldVNode, domParent, scheduler)
      }
    }
  }

  // Second pass: diff matched pairs and place/move DOM nodes in the correct
  // order, similar to Preact's diffChildren + insert.
  vParent._children = newChildren

  let lastPlaced: Node | null = null

  for (let i = 0; i < nextLength; i++) {
    let childVNode = newChildren[i]
    if (!childVNode) continue

    let idx = childVNode._index ?? -1
    let oldVNode = idx >= 0 ? oldChildren[idx] : null

    diffVNodes(
      oldVNode,
      childVNode,
      domParent,
      frame,
      scheduler,
      vParent,
      rootTarget,
      anchor,
      cursor,
    )

    let shouldPlace = (childVNode._flags ?? 0) & INSERT_VNODE
    let firstDom = findFirstDomAnchor(childVNode)
    let lastDom = firstDom ? findLastDomAnchor(childVNode) : null
    if (shouldPlace && firstDom && lastDom && firstDom.parentNode === domParent) {
      let target: Node | null
      if (lastPlaced === null) {
        if (vParent._rangeStart && vParent._rangeStart.parentNode === domParent) {
          target = vParent._rangeStart.nextSibling
        } else {
          target = domParent.firstChild
        }
      } else {
        target = lastPlaced.nextSibling
      }

      if (target === null && anchor) target = anchor

      // If target lies within the range we're moving, skip the move.
      if (target && domRangeContainsNode(firstDom, lastDom, target)) {
        // no-op
      } else if (firstDom !== target) {
        moveDomRange(domParent, firstDom, lastDom, target)
      }
    }

    if (lastDom) lastPlaced = lastDom

    // Clear internal flags for next diff
    childVNode._flags = 0
    childVNode._index = undefined
  }

  return
}

export function findFirstDomAnchor(node: VNode | null | undefined): Node | null {
  if (!node) return null
  if (isCommittedTextNode(node)) return node._dom
  if (isCommittedHostNode(node)) return node._dom
  if (isCommittedComponentNode(node)) return findFirstDomAnchor(node._content)
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      let dom = findFirstDomAnchor(child)
      if (dom) return dom
    }
  }
  return null
}

export function findLastDomAnchor(node: VNode | null | undefined): Node | null {
  if (!node) return null
  if (isCommittedTextNode(node)) return node._dom
  if (isCommittedHostNode(node)) return node._dom
  if (isCommittedComponentNode(node)) return findLastDomAnchor(node._content)
  if (isFragmentNode(node)) {
    for (let i = node._children.length - 1; i >= 0; i--) {
      let dom = findLastDomAnchor(node._children[i])
      if (dom) return dom
    }
  }
  return null
}

function domRangeContainsNode(first: Node, last: Node, node: Node): boolean {
  let current: Node | null = first
  while (current) {
    if (current === node) return true
    if (current === last) break
    current = current.nextSibling
  }
  return false
}

function moveDomRange(domParent: ParentNode, first: Node, last: Node, before: Node | null): void {
  let current: Node | null = first
  while (current) {
    let next: Node | null = current === last ? null : current.nextSibling
    domParent.insertBefore(current, before)
    if (current === last) break
    current = next
  }
}

export function findNextSiblingDomAnchor(curr: VNode, vParent?: VNode): Node | null {
  if (!vParent || !Array.isArray(vParent._children)) return null
  let children = vParent._children
  let idx = children.indexOf(curr)
  if (idx === -1) return null
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findFirstDomAnchor(children[i])
    if (dom) return dom
  }
  return null
}

function reclaimExitingNode(
  exitingNode: CommittedHostNode,
  newNode: HostNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
): void {
  // Reverse the exit animation if it's still running
  let animation = exitingNode._animation
  if (animation && animation.playState === 'running') {
    animation.reverse()
    animation.finished.then(() => {
      exitingNode._animation = undefined
    })
  }

  // Clear exiting state
  unmarkNodeExiting(exitingNode)

  // Transfer exiting node's DOM and state to new node
  newNode._dom = exitingNode._dom
  newNode._parent = vParent
  newNode._controller = exitingNode._controller
  newNode._events = exitingNode._events
  newNode._animation = exitingNode._animation

  // Diff props on the existing DOM element
  diffHostProps(exitingNode.props, newNode.props, exitingNode._dom)

  // Diff children
  diffChildren(
    exitingNode._children,
    newNode._children,
    exitingNode._dom,
    frame,
    scheduler,
    newNode,
    rootTarget,
  )

  // Update event listeners if needed
  let nextOn = newNode.props.on
  if (nextOn) {
    if (newNode._events) {
      let eventsContainer = newNode._events
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)])
    } else {
      let eventsContainer = createContainer(exitingNode._dom)
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)])
      newNode._events = eventsContainer
    }
  } else if (newNode._events) {
    let eventsContainer = newNode._events
    scheduler.enqueueTasks([() => eventsContainer.dispose()])
    newNode._events = undefined
  }
}
