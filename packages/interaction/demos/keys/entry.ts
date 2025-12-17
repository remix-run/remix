import { on } from '@remix-run/interaction'
import * as Keys from '@remix-run/interaction/keys'

let button = document.getElementById('subject')!
let log = document.getElementById('log')!

function writeLog(message: string) {
  log.textContent += `${message}\n`
  log.scrollTop = log.scrollHeight
}

on(button, {
  [Keys.escape]() {
    writeLog('escape')
  },
  [Keys.enter]() {
    writeLog('enter')
  },
  [Keys.space]() {
    writeLog('space')
  },
  [Keys.backspace]() {
    writeLog('backspace')
  },
  [Keys.del]() {
    writeLog('delete')
  },
  [Keys.arrowUp]() {
    writeLog('arrow up')
  },
  [Keys.arrowDown]() {
    writeLog('arrow down')
  },
  [Keys.arrowLeft]() {
    writeLog('arrow left')
  },
  [Keys.arrowRight]() {
    writeLog('arrow right')
  },
  [Keys.home]() {
    writeLog('home')
  },
  [Keys.end]() {
    writeLog('end')
  },
  [Keys.pageUp]() {
    writeLog('page up')
  },
  [Keys.pageDown]() {
    writeLog('page down')
  },
})
