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
export declare const formReset: "rmx:form-reset";
declare global {
    interface HTMLElementEventMap {
        [formReset]: Event;
    }
}
