export function installDebugBoundaries(): () => void {
  let overlay = document.createElement('div')
  overlay.id = 'bookstore-debug-boundaries'
  overlay.setAttribute('aria-hidden', 'true')
  let shadow = overlay.attachShadow({ mode: 'open' })
  let styles = new CSSStyleSheet()
  styles.replaceSync(`
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
    }
    div {
      position: absolute;
      box-sizing: border-box;
      border: 3px solid currentColor;
    }
    [data-boundary="frame"] { color: #2563eb; }
    [data-boundary="client-entry"] { color: #16a34a; }
    span {
      position: absolute;
      bottom: 100%;
      padding: 2px 5px;
      background: currentColor;
      white-space: nowrap;
      font: bold 11px/1.4 system-ui, sans-serif;
    }
    span::after { color: white; }
    [data-boundary="frame"] span { left: -3px; }
    [data-boundary="frame"] span::after { content: 'Frame'; }
    [data-boundary="client-entry"] span { right: -3px; }
    [data-boundary="client-entry"] span::after { content: 'Client Entry'; }
  `)
  shadow.adoptedStyleSheets = [styles]

  let enabled = false
  let animationFrame = 0
  let boxes: HTMLDivElement[] = []
  let controller = new AbortController()

  function draw() {
    if (!overlay.isConnected) document.documentElement.append(overlay)

    // These markers and the adopted client-entry root property are internal Remix details.
    let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT)
    let frames: Comment[] = []
    let entries: Comment[] = []
    let count = 0
    let node: Node | null
    while ((node = walker.nextNode())) {
      if (!(node instanceof Comment)) continue
      let marker = node.data.trim()
      if (marker.startsWith('rmx:f:')) {
        frames.push(node)
        continue
      }
      if (marker.startsWith('rmx:h:')) {
        entries.push(node)
        continue
      }
      if (marker !== '/rmx:f' && marker !== '/rmx:h') continue

      let isFrame = marker === '/rmx:f'
      let start = (isFrame ? frames : entries).pop()
      if (!start || start.parentNode !== node.parentNode) continue
      if (!isFrame && !('$rmx' in start)) continue

      let rects: DOMRect[] = []
      for (let child = start.nextSibling; child && child !== node; child = child.nextSibling) {
        rects.push(...getVisibleRects(child))
      }
      rects = rects.filter((rect) => rect.width > 0 && rect.height > 0)
      if (rects.length === 0) continue
      let left = Math.min(...rects.map((rect) => rect.left))
      let top = Math.min(...rects.map((rect) => rect.top))
      let right = Math.max(...rects.map((rect) => rect.right))
      let bottom = Math.max(...rects.map((rect) => rect.bottom))

      let box = boxes[count]
      if (!box) {
        box = document.createElement('div')
        box.append(document.createElement('span'))
        boxes.push(box)
        shadow.append(box)
      }
      count++
      box.dataset.boundary = isFrame ? 'frame' : 'client-entry'
      // Place frame borders outside the range so coincident client entries remain visible.
      let outset = isFrame ? 3 : 0
      box.style.left = `${left - outset}px`
      box.style.top = `${top - outset}px`
      box.style.width = `${right - left + outset * 2}px`
      box.style.height = `${bottom - top + outset * 2}px`
    }
    while (boxes.length > count) boxes.pop()?.remove()

    let labels: DOMRect[] = []
    for (let box of boxes.toReversed()) {
      let label = box.querySelector('span')
      if (!label) continue
      label.style.translate = 'none'
      let rect = label.getBoundingClientRect()
      let offset = 0
      for (let previous of labels) {
        if (
          rect.left < previous.right &&
          rect.right > previous.left &&
          rect.top < previous.bottom &&
          rect.bottom > previous.top
        ) {
          let distance = previous.right - rect.left + 2
          offset += distance
          rect.x += distance
        }
      }
      label.style.translate = `${offset}px 0`
      labels.push(rect)
    }

    animationFrame = requestAnimationFrame(draw)
  }

  window.addEventListener(
    'keydown',
    (event) => {
      if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() !== 'd') return
      event.preventDefault()
      if (event.repeat) return
      enabled = !enabled
      if (enabled) {
        draw()
      } else {
        cancelAnimationFrame(animationFrame)
        overlay.remove()
      }
    },
    { capture: true, signal: controller.signal },
  )

  return () => {
    controller.abort()
    cancelAnimationFrame(animationFrame)
    overlay.remove()
  }
}

function getVisibleRects(node: Node): DOMRect[] {
  if (node instanceof Element) {
    // display: contents has no box of its own, but its children can include padded controls.
    if (getComputedStyle(node).display === 'contents') {
      return Array.from(node.childNodes).flatMap(getVisibleRects)
    }
    return Array.from(node.getClientRects())
  }
  if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
    let range = document.createRange()
    range.selectNode(node)
    return Array.from(range.getClientRects())
  }
  return []
}
