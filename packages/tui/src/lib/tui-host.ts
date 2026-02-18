export type TuiHostNode = {
  type: 'element' | 'text'
  tag: string
  text: string
  props: Record<string, unknown>
  renderable?: unknown
}

export type TuiHostBridge = {
  createElement(type: string): TuiHostNode
  createText(value: string): TuiHostNode
  setText(node: TuiHostNode, value: string): void
  insert(parent: unknown, node: TuiHostNode, anchor: null | TuiHostNode): void
  move(parent: unknown, node: TuiHostNode, anchor: null | TuiHostNode): void
  remove(parent: unknown, node: TuiHostNode): void
  setProp(node: TuiHostNode, key: string, value: unknown): void
  removeProp(node: TuiHostNode, key: string): void
  dispose?(): void
}

export async function createOpenTuiHostBridge(options: Record<string, unknown> = {}) {
  let opentui = (await import('@opentui/core')) as Record<string, unknown>
  let createCliRenderer = opentui.createCliRenderer as
    | undefined
    | ((config?: Record<string, unknown>) => Promise<Record<string, unknown>>)
  let BoxRenderable = opentui.BoxRenderable as
    | undefined
    | (new (ctx: unknown, options: Record<string, unknown>) => unknown)
  let TextRenderable = opentui.TextRenderable as
    | undefined
    | (new (ctx: unknown, options: Record<string, unknown>) => unknown)
  if (!createCliRenderer || !BoxRenderable || !TextRenderable) {
    throw new Error('unable to load OpenTUI core renderer classes')
  }

  let renderer = await createCliRenderer(options)
  let bridge = decorateBridgeWithOpenTui(renderer as Record<string, unknown>, BoxRenderable, TextRenderable)
  return {
    renderer,
    bridge,
  }
}

function decorateBridgeWithOpenTui(
  renderer: Record<string, unknown>,
  BoxRenderable: new (ctx: unknown, options: Record<string, unknown>) => unknown,
  TextRenderable: new (ctx: unknown, options: Record<string, unknown>) => unknown,
): TuiHostBridge {
  let root = resolveRendererRoot(renderer)
  let textChildrenByParent = new WeakMap<object, TuiHostNode[]>()

  return {
    createElement(type) {
      let isText = type === 'text'
      let renderable = isText
        ? new TextRenderable(renderer, { content: '' })
        : new BoxRenderable(renderer, {
            flexDirection: type === 'row' ? 'row' : 'column',
          })
      return {
        type: 'element',
        tag: type,
        text: '',
        props: {},
        renderable,
      }
    },
    createText(value) {
      return {
        type: 'text',
        tag: '#text',
        text: value,
        props: {},
      }
    },
    setText(node, value) {
      node.text = value
      let renderable = node.renderable
      if (renderable && hasPropertySetter(renderable, 'content')) {
        ;(renderable as { content: string }).content = value
        return
      }
      let parentTextRenderable = node.props.__parentTextRenderable
      if (!parentTextRenderable || typeof parentTextRenderable !== 'object') return
      refreshParentTextContent(parentTextRenderable as object, textChildrenByParent)
    },
    insert(parent, node, anchor) {
      let parentRenderable = resolveParentRenderable(root, parent)
      if (!parentRenderable) return
      if (isTextRenderable(parentRenderable) && node.type === 'text') {
        addTextChild(parentRenderable, node, anchor ?? null, textChildrenByParent)
        return
      }
      let childRenderable = ensureRenderable(node, renderer, TextRenderable)
      if (!childRenderable) return
      let anchorRenderable = anchor ? ensureRenderable(anchor, renderer, TextRenderable) : null
      if (anchorRenderable && hasMethod(parentRenderable, 'insertBefore')) {
        ;(parentRenderable as { insertBefore(obj: unknown, anchorObj: unknown): void }).insertBefore(
          childRenderable,
          anchorRenderable,
        )
      } else if (hasMethod(parentRenderable, 'add')) {
        ;(parentRenderable as { add(obj: unknown): void }).add(childRenderable)
      }
    },
    move(parent, node, anchor) {
      let parentRenderable = resolveParentRenderable(root, parent)
      if (!parentRenderable) return
      if (isTextRenderable(parentRenderable) && node.type === 'text') {
        moveTextChild(parentRenderable, node, anchor ?? null, textChildrenByParent)
        return
      }
      let childRenderable = ensureRenderable(node, renderer, TextRenderable)
      if (!childRenderable) return
      let childId = getRenderableId(childRenderable)
      if (childId && hasMethod(parentRenderable, 'remove')) {
        ;(parentRenderable as { remove(id: string): void }).remove(childId)
      }
      let anchorRenderable = anchor ? ensureRenderable(anchor, renderer, TextRenderable) : null
      if (anchorRenderable && hasMethod(parentRenderable, 'insertBefore')) {
        ;(parentRenderable as { insertBefore(obj: unknown, anchorObj: unknown): void }).insertBefore(
          childRenderable,
          anchorRenderable,
        )
      } else if (hasMethod(parentRenderable, 'add')) {
        ;(parentRenderable as { add(obj: unknown): void }).add(childRenderable)
      }
    },
    remove(parent, node) {
      let parentRenderable = resolveParentRenderable(root, parent)
      if (!parentRenderable) return
      if (isTextRenderable(parentRenderable) && node.type === 'text') {
        removeTextChild(parentRenderable, node, textChildrenByParent)
        return
      }
      let childRenderable = ensureRenderable(node, renderer, TextRenderable)
      let childId = childRenderable ? getRenderableId(childRenderable) : null
      if (!childId || !hasMethod(parentRenderable, 'remove')) return
      ;(parentRenderable as { remove(id: string): void }).remove(childId)
    },
    setProp(node, key, value) {
      node.props[key] = value
      let renderable = node.renderable
      if (!renderable || typeof renderable !== 'object') return
      if (key.startsWith('style.')) {
        applyStyleProp(renderable as Record<string, unknown>, key.slice('style.'.length), value)
        return
      }
      if (key.startsWith('layout.')) {
        applyLayoutProp(renderable as Record<string, unknown>, key.slice('layout.'.length), value)
        return
      }
      if (key.startsWith('on.')) {
        applyEventProp(renderable as Record<string, unknown>, key.slice('on.'.length), value)
        return
      }
      setIfPresent(renderable as Record<string, unknown>, key, value)
    },
    removeProp(node, key) {
      delete node.props[key]
      let renderable = node.renderable
      if (!renderable || typeof renderable !== 'object') return
      if (key.startsWith('style.')) {
        applyStyleProp(renderable as Record<string, unknown>, key.slice('style.'.length), undefined)
        return
      }
      if (key.startsWith('layout.')) {
        applyLayoutProp(renderable as Record<string, unknown>, key.slice('layout.'.length), undefined)
        return
      }
      if (key.startsWith('on.')) {
        applyEventProp(renderable as Record<string, unknown>, key.slice('on.'.length), undefined)
        return
      }
      setIfPresent(renderable as Record<string, unknown>, key, undefined)
    },
    dispose() {
      if (hasMethod(renderer, 'destroy')) {
        ;(renderer as { destroy(): void }).destroy()
      }
    },
  }
}

function resolveRendererRoot(renderer: Record<string, unknown>) {
  let root = renderer.root
  if (root && typeof root === 'object') {
    return root as Record<string, unknown>
  }
  return renderer
}

function hasMethod(value: unknown, name: string) {
  if (!value || typeof value !== 'object') return false
  return typeof (value as Record<string, unknown>)[name] === 'function'
}

function resolveParentRenderable(root: Record<string, unknown>, parent: unknown) {
  if (parent && typeof parent === 'object' && 'renderable' in (parent as Record<string, unknown>)) {
    return (parent as { renderable?: unknown }).renderable
  }
  return root
}

function ensureRenderable(
  node: TuiHostNode,
  renderer: unknown,
  TextRenderable: new (ctx: unknown, options: Record<string, unknown>) => unknown,
) {
  if (node.renderable) return node.renderable
  if (node.type !== 'text') return null
  node.renderable = new TextRenderable(renderer, { content: node.text })
  return node.renderable
}

function getRenderableId(renderable: unknown) {
  if (!renderable || typeof renderable !== 'object') return null
  let id = (renderable as { id?: unknown }).id
  if (typeof id !== 'string') return null
  return id
}

function isTextRenderable(renderable: unknown) {
  if (!renderable || typeof renderable !== 'object') return false
  return hasPropertySetter(renderable, 'content')
}

function hasPropertySetter(renderable: unknown, key: string) {
  if (!renderable || typeof renderable !== 'object') return false
  let proto = Object.getPrototypeOf(renderable)
  if (!proto || typeof proto !== 'object') return false
  let descriptor = Object.getOwnPropertyDescriptor(proto, key)
  return Boolean(descriptor && typeof descriptor.set === 'function')
}

function addTextChild(
  parentRenderable: object,
  node: TuiHostNode,
  anchor: null | TuiHostNode,
  textChildrenByParent: WeakMap<object, TuiHostNode[]>,
) {
  let list = textChildrenByParent.get(parentRenderable) ?? []
  let index = anchor ? list.indexOf(anchor) : -1
  if (index < 0) {
    list.push(node)
  } else {
    list.splice(index, 0, node)
  }
  node.props.__parentTextRenderable = parentRenderable
  textChildrenByParent.set(parentRenderable, list)
  refreshParentTextContent(parentRenderable, textChildrenByParent)
}

function moveTextChild(
  parentRenderable: object,
  node: TuiHostNode,
  anchor: null | TuiHostNode,
  textChildrenByParent: WeakMap<object, TuiHostNode[]>,
) {
  let list = textChildrenByParent.get(parentRenderable) ?? []
  let from = list.indexOf(node)
  if (from < 0) return
  list.splice(from, 1)
  let to = anchor ? list.indexOf(anchor) : -1
  if (to < 0) {
    list.push(node)
  } else {
    list.splice(to, 0, node)
  }
  textChildrenByParent.set(parentRenderable, list)
  refreshParentTextContent(parentRenderable, textChildrenByParent)
}

function removeTextChild(
  parentRenderable: object,
  node: TuiHostNode,
  textChildrenByParent: WeakMap<object, TuiHostNode[]>,
) {
  let list = textChildrenByParent.get(parentRenderable) ?? []
  let index = list.indexOf(node)
  if (index >= 0) list.splice(index, 1)
  delete node.props.__parentTextRenderable
  textChildrenByParent.set(parentRenderable, list)
  refreshParentTextContent(parentRenderable, textChildrenByParent)
}

function refreshParentTextContent(
  parentRenderable: object,
  textChildrenByParent: WeakMap<object, TuiHostNode[]>,
) {
  let list = textChildrenByParent.get(parentRenderable) ?? []
  let content = list.map((child) => child.text).join('')
  ;(parentRenderable as { content: string }).content = content
}

function applyStyleProp(renderable: Record<string, unknown>, key: string, value: unknown) {
  if (key === 'color') {
    setIfPresent(renderable, 'fg', value)
    return
  }
  if (key === 'backgroundColor' || key === 'bg') {
    setIfPresent(renderable, 'bg', value)
    return
  }
  if (key === 'bold') {
    setIfPresent(renderable, 'attributes', value ? 1 : 0)
    return
  }
  setIfPresent(renderable, key, value)
}

function applyLayoutProp(renderable: Record<string, unknown>, key: string, value: unknown) {
  setIfPresent(renderable, key, value)
}

function applyEventProp(renderable: Record<string, unknown>, key: string, value: unknown) {
  if (key === 'keypress') {
    setIfPresent(renderable, 'onKeyDown', value)
    return
  }
  if (key === 'focus') {
    if (typeof value === 'function' && hasMethod(renderable, 'on')) {
      ;(renderable as { on(event: string, handler: (...args: unknown[]) => void): void }).on(
        'focused',
        value as (...args: unknown[]) => void,
      )
    }
    return
  }
  setIfPresent(renderable, `on${capitalize(key)}`, value)
}

function setIfPresent(renderable: Record<string, unknown>, key: string, value: unknown) {
  if (!(key in renderable)) return
  renderable[key] = value
}

function capitalize(value: string) {
  if (value.length === 0) return value
  return `${value[0].toUpperCase()}${value.slice(1)}`
}
