import { on } from '@remix-run/interaction'
import { popoverToggle, beforePopoverToggle } from '@remix-run/interaction/popover'

let button = document.querySelector('button')!
let log = document.getElementById('log')!

on(button, {
  [popoverToggle](event) {
    log.textContent += `my popover toggled: ${event.newState}\n`
  },
  [beforePopoverToggle](event) {
    log.textContent += `before my popover toggled: ${event.newState}\n`
  },
})
