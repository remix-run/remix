import { on } from '../../src/lib/events.ts'
import { popoverToggle, beforePopoverToggle } from '../../src/lib/interactions/popover.ts'

let button = document.querySelector('button')!
let log = document.getElementById('log')!

on(button, {
  [popoverToggle]: (event) => {
    log.textContent += `my popover toggled: ${event.newState}\n`
  },
  [beforePopoverToggle]: (event) => {
    log.textContent += `before my popover toggled: ${event.newState}\n`
  },
})
