import { defineInteraction, type Interaction } from '../interaction.ts'

/**
 * Called when the target's form is reset. Useful for resetting custom component
 * state and hidden input values (like Listbox, Combobox, etc.)
 *
 * @example
 * ```tsx
 * events(someHiddenInput).on([
 *   formReset(() => {
 *     // reset custom component state
 *     hiddenInput.value = ''
 *   }),
 * ])
 * ```
 */
export const formReset = defineInteraction('rmx:form-reset', FormReset)

declare global {
  interface HTMLElementEventMap {
    [formReset]: Event
  }
}

function FormReset(this: Interaction) {
  if (!(this.target instanceof HTMLElement)) return

  let target = this.target
  let form =
    'form' in target && target.form instanceof HTMLFormElement
      ? target.form
      : target.closest('form')

  if (form) {
    this.on(form, {
      reset() {
        target.dispatchEvent(new Event(formReset))
      },
    })
  }
}
