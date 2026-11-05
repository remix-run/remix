import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { onSubmission } from '../../index.ts'
import { createFormSubmissionEvent } from '../form-submission-event.ts'
import { invariant } from '../invariant.ts'
import { createRoot } from '../vdom.ts'

describe('onSubmission mixin', () => {
  it('follows Remix submissions during capture and ignores native submit events', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    let order: string[] = []
    container.addEventListener('rmx:submission', () => order.push('ancestor'))
    let signals: AbortSignal[] = []
    root.render(
      <form
        mix={onSubmission((event, signal) => {
          order.push('form')
          signals.push(signal)
          expect(event.currentTarget).toBe(form)
          expect(event.form).toBe(form)
          expect(event.submitter).toBe(button)
        }, true)}
      >
        <button
          type="submit"
          mix={onSubmission((event, signal) => {
            order.push('button')
            signals.push(signal)
            expect(event.currentTarget).toBe(button)
            event.stopPropagation()
          })}
        >
          Save
        </button>
      </form>,
    )
    root.flush()
    let form = container.querySelector('form')
    let button = container.querySelector('button')
    invariant(form)
    invariant(button)

    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, submitter: button }))
    expect(order).toEqual([])
    button.dispatchEvent(
      createFormSubmissionEvent({
        src: '/save',
        method: 'post',
        encType: 'application/x-www-form-urlencoded',
        formData: new FormData(),
        form,
        submitter: button,
        finished: Promise.resolve(new AbortController().signal),
      }),
    )

    expect(order).toEqual(['form', 'button'])
    expect(signals.map((signal) => signal.aborted)).toEqual([false, false])
    root.dispose()
    expect(signals.map((signal) => signal.aborted)).toEqual([true, true])
  })
})
