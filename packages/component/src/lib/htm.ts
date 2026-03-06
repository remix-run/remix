import { jsx, type RemixNode } from './jsx.ts'
import { Fragment } from './component.ts'

const TEXT = 0
const TAG_OPEN = 1
const TAG_NAME = 2
const ATTRS = 3
const ATTR_NAME = 4
const ATTR_EQ = 5
const ATTR_VALUE_QUOTED = 6
const CLOSE_TAG = 7
const SELF_CLOSE = 8

interface Frame {
  type: string | Function
  props: Record<string, any>
  children: RemixNode[]
}

function normalizeChildren(children: RemixNode[]): RemixNode | undefined {
  if (children.length === 0) return undefined
  if (children.length === 1) return children[0]
  return children
}

export function html(strings: TemplateStringsArray, ...values: any[]): RemixNode {
  let root: Frame = { type: Fragment, props: {}, children: [] }
  let stack: Frame[] = [root]

  let state = TEXT
  let buf = ''
  let attrName = ''
  let attrQuote = ''

  function frame(): Frame {
    return stack[stack.length - 1]
  }

  function pushText() {
    if (buf) {
      frame().children.push(buf)
      buf = ''
    }
  }

  function openTag(type: string | Function) {
    stack.push({ type, props: {}, children: [] })
    state = ATTRS
  }

  function closeTag() {
    let f = stack.pop()!
    let ch = normalizeChildren(f.children)
    let props = ch !== undefined ? { ...f.props, children: ch } : { ...f.props }
    frame().children.push(jsx(f.type as any, props))
    state = TEXT
  }

  function setAttr(name: string, val: any) {
    frame().props[name] = val
  }

  function flushBoolAttr() {
    if (attrName) {
      setAttr(attrName, true)
      attrName = ''
    }
  }

  for (let i = 0; i < strings.length; i++) {
    let s = strings[i]

    for (let j = 0; j < s.length; j++) {
      let c = s[j]

      if (state === TEXT) {
        if (c === '<') { pushText(); state = TAG_OPEN }
        else buf += c
      } else if (state === TAG_OPEN) {
        if (c === '/') state = CLOSE_TAG
        else if (c === '>') { openTag(Fragment); state = TEXT }
        else if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') { buf = c; state = TAG_NAME }
      } else if (state === TAG_NAME) {
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { openTag(buf); buf = '' }
        else if (c === '>') { openTag(buf); buf = ''; state = TEXT }
        else if (c === '/') { openTag(buf); buf = ''; state = SELF_CLOSE }
        else buf += c
      } else if (state === ATTRS) {
        if (c === '>') { flushBoolAttr(); state = TEXT }
        else if (c === '/') { flushBoolAttr(); state = SELF_CLOSE }
        else if (c === ' ' || c === '\t' || c === '\n' || c === '\r') flushBoolAttr()
        else { flushBoolAttr(); buf = c; state = ATTR_NAME }
      } else if (state === ATTR_NAME) {
        if (c === '=') { attrName = buf; buf = ''; state = ATTR_EQ }
        else if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { attrName = buf; buf = ''; state = ATTRS }
        else if (c === '>') { attrName = buf; buf = ''; flushBoolAttr(); state = TEXT }
        else if (c === '/') { attrName = buf; buf = ''; flushBoolAttr(); state = SELF_CLOSE }
        else buf += c
      } else if (state === ATTR_EQ) {
        if (c === '"' || c === "'") { attrQuote = c; buf = ''; state = ATTR_VALUE_QUOTED }
        else if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') { attrQuote = ''; buf = c; state = ATTR_VALUE_QUOTED }
      } else if (state === ATTR_VALUE_QUOTED) {
        if (!attrQuote && (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '>')) {
          setAttr(attrName, buf); attrName = ''; buf = ''
          state = c === '>' ? TEXT : ATTRS
        } else if (attrQuote && c === attrQuote) {
          setAttr(attrName, buf); attrName = ''; buf = ''; state = ATTRS
        } else buf += c
      } else if (state === CLOSE_TAG) {
        if (c === '>') { buf = ''; closeTag() }
        // accumulate or ignore tag name / second slash in <//>
      } else if (state === SELF_CLOSE) {
        if (c === '>') closeTag()
      }
    }

    // Consume interpolated value[i]
    if (i < values.length) {
      let val = values[i]

      if (state === TAG_OPEN) {
        // <${Component}>
        openTag(val)
      } else if (state === TAG_NAME) {
        if (typeof val === 'string') buf += val
      } else if (state === ATTR_NAME) {
        if (buf === '...') {
          // Spread: ...${props}
          if (val && typeof val === 'object') Object.assign(frame().props, val)
          buf = ''; attrName = ''; state = ATTRS
        } else {
          // Dynamic attr name with value
          attrName = buf; buf = ''
          setAttr(attrName, val); attrName = ''; state = ATTRS
        }
      } else if (state === ATTR_EQ) {
        // Dynamic value: attr=${val}
        setAttr(attrName, val); attrName = ''; state = ATTRS
      } else if (state === TEXT) {
        pushText()
        if (val != null) {
          frame().children.push(val as RemixNode)
        }
      }
      // CLOSE_TAG: </${Comp}> — ignore the value, wait for >
    }
  }

  let result = root.children
  if (result.length === 0) return null as any
  if (result.length === 1) return result[0]!
  return result as any
}
