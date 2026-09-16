import { countWords } from '#count-words'

globalThis.addEventListener('message', (event: MessageEvent<{ text: string }>) => {
  globalThis.postMessage({ wordCount: countWords(event.data.text) }, { transfer: [] })
})
