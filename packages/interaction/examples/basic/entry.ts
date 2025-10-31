import { on } from '../../src/lib/events.ts'

let button = document.getElementById('button')!
let log = document.getElementById('log')!

on(button, {
  click: () => {
    log.textContent += 'clicked\n'
  },
})
