import { on } from '@remix-run/interaction'
import { longPress, press, pressDown, pressUp, pressCancel } from '@remix-run/interaction/press'

let currentCircle: HTMLDivElement | null = null

function cleanupCircle() {
  if (currentCircle) {
    currentCircle.remove()
    currentCircle = null
  }
}

let subject = document.getElementById('subject')!
let log = document.getElementById('log')!
let timer: number = 0

on(subject, {
  [longPress](event) {
    event.preventDefault() // prevent subsequent `press`/`pressUp` events
    writeLog('long press')

    // Pop, color change, and fade out effect
    if (currentCircle) {
      currentCircle.style.transition =
        'transform 0.15s ease-out, opacity 0.15s ease-out, background 0.1s ease-out, border-color 0.1s ease-out'
      currentCircle.style.transform = 'translate(-50%, -50%) scale(3)'
      currentCircle.style.background = 'rgba(70, 223, 108, 0.8)'
      currentCircle.style.borderColor = 'rgba(70, 223, 108, 0.8)'
      currentCircle.style.opacity = '0'

      // cleanup the circle after 200ms, save it so we can interrupt it with a new pressDown
      timer = window.setTimeout(cleanupCircle, 200)
    }
  },

  [press]() {
    writeLog('press')
  },

  [pressUp]() {
    writeLog('press up')
    cleanupCircle()
  },

  pointerleave() {
    cleanupCircle()
  },

  [pressCancel]() {
    writeLog('press cancel')
    cleanupCircle()
  },

  [pressDown](event) {
    writeLog('press down')
    window.clearTimeout(timer)

    let rect = event.currentTarget.getBoundingClientRect()
    let clientX = event.clientX || rect.left + rect.width / 2
    let clientY = event.clientY || rect.top + rect.height / 2

    // Calculate position relative to the element
    let relativeX = clientX - rect.left
    let relativeY = clientY - rect.top

    // Clean up any existing circle first
    cleanupCircle()

    // Create the growing circle
    currentCircle = document.createElement('div')
    currentCircle.style.cssText = `
      position: absolute;
      left: ${relativeX}px;
      top: ${relativeY}px;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      border: 2px solid rgba(255, 255, 255, 0.6);
      pointer-events: none;
      z-index: 10;
      transform: translate(-50%, -50%);
      transition: width 0.5s ease-out, height 0.5s ease-out;
    `
    event.currentTarget.appendChild(currentCircle)

    // Start growing animation - bigger size for better visibility
    requestAnimationFrame(() => {
      if (currentCircle) {
        currentCircle.style.width = '180px'
        currentCircle.style.height = '180px'
      }
    })
  },
})

function writeLog(message: string) {
  log.textContent += `${message}\n`
  log.scrollTop = log.scrollHeight
}

// prevent ios zoom
document.addEventListener('dblclick', (event) => {
  event.preventDefault()
})
