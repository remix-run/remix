import { on } from '@remix-run/interaction'
import { formReset } from '@remix-run/interaction/form'

let myForm = document.querySelector('form') as HTMLFormElement
let hiddenInput = document.querySelector('input[type="hidden"]') as HTMLInputElement
let output = document.querySelector('#output') as HTMLPreElement

on(myForm, {
  submit(event) {
    event.preventDefault()
  },

  input(event) {
    let json = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    delete json.hidden
    hiddenInput.value = JSON.stringify(json, null, 2)
    output.textContent = JSON.stringify(json, null, 2)
  },
})

on(hiddenInput, {
  [formReset]() {
    hiddenInput.value = ''
    output.textContent = ''
  },
})
