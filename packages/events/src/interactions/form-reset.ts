import { createInteraction } from '../lib/interactions.ts'
import { events } from '../lib/events.ts'
import { dom } from '../lib/targets.ts'

export type FormResetEventDetail = {
  originalEvent: Event
  form: HTMLFormElement
}

/**
 * Creates an interaction that listens for the "reset" event on the form that
 * owns the target element. This is useful for form controls that need to react
 * when their containing form is reset.
 *
 * The interaction will only work on form-associated elements (elements that have
 * a `.form` property pointing to their owner form). If the element is not
 * associated with a form, the interaction will do nothing.
 *
 * @example
 * ```tsx
 * import { formReset } from 'remix/interactions';
 *
 * function CustomInput(this: Handle) {
 *   let value = '';
 *
 *   return () => (
 *     <input
 *       value={value}
 *       on={[
 *         dom.input((event) => {
 *           value = event.currentTarget.value;
 *           this.render();
 *         }),
 *         formReset(() => {
 *           value = '';
 *           this.render();
 *         }),
 *       ]}
 *       onChange={(event) => {
 *         value = event.target.value;
 *         this.render();
 *       }}
 *     />
 *   );
 * }
 * ```
 */
export let formReset = createInteraction<
  HTMLElement & { form?: HTMLFormElement | null },
  FormResetEventDetail
>('formReset', ({ dispatch, target }) => {
  // Check if the target element has a form property and is associated with a form
  if (!('form' in target) || !target.form) {
    // Element is not form-associated or not in a form, so no cleanup needed
    return
  }

  let form = target.form

  return events(form, [
    dom.reset((event) => {
      dispatch(
        {
          detail: {
            originalEvent: event,
            form: form,
          },
        },
        event,
      )
    }),
  ])
})
