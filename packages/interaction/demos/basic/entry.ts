import { on } from '@remix-run/interaction'

let button = document.getElementById('button')!
let log = document.getElementById('log')!

on(button, {
  click() {
    log.textContent += 'clicked\n'
  },
})
