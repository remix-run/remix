import { clientEntry, on, type Handle } from 'remix/ui'

import { getContent } from './content.ts'

export const AssetsDemo = clientEntry(
  import.meta.url,
  function AssetsDemo(handle: Handle<{ workerUrl: string }>) {
    let result = ''
    let worker: Worker | undefined

    handle.queueTask(() => {
      try {
        worker = new Worker(handle.props.workerUrl, { type: 'module' })
      } catch {
        result = 'Worker failed to start.'
        handle.update()
        return
      }

      worker.addEventListener(
        'message',
        (event: MessageEvent<{ wordCount: number }>) => {
          let { wordCount } = event.data
          result = `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`
          handle.update()
        },
        { signal: handle.signal },
      )
      worker.addEventListener(
        'error',
        () => {
          result = 'Worker failed to load.'
          handle.update()
        },
        { signal: handle.signal },
      )
      worker.addEventListener(
        'messageerror',
        () => {
          result = 'Worker returned an invalid response.'
          handle.update()
        },
        { signal: handle.signal },
      )

      handle.signal.addEventListener('abort', () => worker?.terminate())
    })

    return () => (
      <section class="web-worker" aria-live="polite">
        <h2>Web Workers</h2>
        <p>{getContent()}</p>
        <form
          class="worker-form"
          mix={on('submit', (event) => {
            event.preventDefault()
            let formData = new FormData(event.currentTarget)

            result = 'Counting…'
            handle.update()
            worker?.postMessage({ text: String(formData.get('text') ?? '') })
          })}
        >
          <label for="worker-text">Text to count in a Web Worker</label>
          <input
            id="worker-text"
            name="text"
            autoComplete="off"
            defaultValue="Remix serves browser modules from source without bundling them first."
          />
          <button type="submit">Count words</button>
          <output aria-live="polite">{result}</output>
        </form>
      </section>
    )
  },
)
