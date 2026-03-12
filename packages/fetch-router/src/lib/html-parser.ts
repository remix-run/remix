export interface HTMLElement {
  name: string
  getAttribute(name: string): string | null
}

const State = {
  TEXT: 0,
  TAG_OPEN: 1,
  TAG_NAME: 2,
  BEFORE_ATTR: 3,
  ATTR_NAME: 4,
  AFTER_ATTR_NAME: 5,
  ATTR_VALUE_UNQUOTED: 6,
  ATTR_VALUE_DOUBLE_QUOTED: 7,
  ATTR_VALUE_SINGLE_QUOTED: 8,
  COMMENT: 9,
} as const

type StateValue = (typeof State)[keyof typeof State]

class Element implements HTMLElement {
  name: string
  #attributes: Map<string, string>

  constructor(name: string) {
    this.name = name.toLowerCase()
    this.#attributes = new Map()
  }

  setAttribute(name: string, value: string) {
    this.#attributes.set(name.toLowerCase(), value)
  }

  getAttribute(name: string): string | null {
    return this.#attributes.get(name.toLowerCase()) ?? null
  }
}

export function parse(html: string): HTMLElement[] {
  let elements: HTMLElement[] = []
  let state: StateValue = State.TEXT
  let i = 0
  let currentElement: Element | null = null
  let currentTagName = ''
  let currentAttrName = ''
  let currentAttrValue = ''

  while (i < html.length) {
    let char = html[i]

    switch (state) {
      case State.TEXT:
        if (char === '<') {
          // Check if this is a comment
          if (html.substring(i, i + 4) === '<!--') {
            state = State.COMMENT
            i += 4
            continue
          }
          // Check if this is a closing tag
          if (html[i + 1] === '/') {
            // Skip closing tags
            i++
            while (i < html.length && html[i] !== '>') {
              i++
            }
            i++
            continue
          }
          state = State.TAG_OPEN
          currentTagName = ''
        }
        break

      case State.COMMENT:
        // Skip until we find -->
        if (html.substring(i, i + 3) === '-->') {
          state = State.TEXT
          i += 3
          continue
        }
        break

      case State.TAG_OPEN:
        if (char === '>') {
          state = State.TEXT
        } else if (/\s/.test(char)) {
          // Ignore leading whitespace
        } else {
          state = State.TAG_NAME
          currentTagName = char
        }
        break

      case State.TAG_NAME:
        if (char === '>' || char === '/') {
          currentElement = new Element(currentTagName)
          elements.push(currentElement)
          if (char === '/') {
            // Self-closing tag, skip to >
            while (i < html.length && html[i] !== '>') {
              i++
            }
          }
          state = State.TEXT
          currentElement = null
        } else if (/\s/.test(char)) {
          currentElement = new Element(currentTagName)
          state = State.BEFORE_ATTR
        } else {
          currentTagName += char
        }
        break

      case State.BEFORE_ATTR:
        if (char === '>' || char === '/') {
          elements.push(currentElement!)
          if (char === '/') {
            // Self-closing tag, skip to >
            while (i < html.length && html[i] !== '>') {
              i++
            }
          }
          state = State.TEXT
          currentElement = null
        } else if (!/\s/.test(char)) {
          state = State.ATTR_NAME
          currentAttrName = char
          currentAttrValue = ''
        }
        break

      case State.ATTR_NAME:
        if (char === '=') {
          state = State.AFTER_ATTR_NAME
        } else if (/\s/.test(char)) {
          // Boolean attribute
          currentElement!.setAttribute(currentAttrName, '')
          state = State.BEFORE_ATTR
          currentAttrName = ''
        } else if (char === '>' || char === '/') {
          // Boolean attribute at end of tag
          currentElement!.setAttribute(currentAttrName, '')
          elements.push(currentElement!)
          if (char === '/') {
            // Self-closing tag, skip to >
            while (i < html.length && html[i] !== '>') {
              i++
            }
          }
          state = State.TEXT
          currentElement = null
          currentAttrName = ''
        } else {
          currentAttrName += char
        }
        break

      case State.AFTER_ATTR_NAME:
        if (char === '"') {
          state = State.ATTR_VALUE_DOUBLE_QUOTED
          currentAttrValue = ''
        } else if (char === "'") {
          state = State.ATTR_VALUE_SINGLE_QUOTED
          currentAttrValue = ''
        } else if (!/\s/.test(char)) {
          state = State.ATTR_VALUE_UNQUOTED
          currentAttrValue = char
        }
        break

      case State.ATTR_VALUE_DOUBLE_QUOTED:
        if (char === '"') {
          currentElement!.setAttribute(currentAttrName, currentAttrValue)
          state = State.BEFORE_ATTR
          currentAttrName = ''
          currentAttrValue = ''
        } else {
          currentAttrValue += char
        }
        break

      case State.ATTR_VALUE_SINGLE_QUOTED:
        if (char === "'") {
          currentElement!.setAttribute(currentAttrName, currentAttrValue)
          state = State.BEFORE_ATTR
          currentAttrName = ''
          currentAttrValue = ''
        } else {
          currentAttrValue += char
        }
        break

      case State.ATTR_VALUE_UNQUOTED:
        if (/\s/.test(char) || char === '>' || char === '/') {
          currentElement!.setAttribute(currentAttrName, currentAttrValue)
          currentAttrName = ''
          currentAttrValue = ''
          if (char === '>' || char === '/') {
            elements.push(currentElement!)
            if (char === '/') {
              // Self-closing tag, skip to >
              while (i < html.length && html[i] !== '>') {
                i++
              }
            }
            state = State.TEXT
            currentElement = null
          } else {
            state = State.BEFORE_ATTR
          }
        } else {
          currentAttrValue += char
        }
        break
    }

    i++
  }

  return elements
}
