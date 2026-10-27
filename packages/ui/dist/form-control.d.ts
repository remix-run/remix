import { on } from '@remix-run/component';
import type { Dispatched, ElementProps } from '@remix-run/component';
import type { ErrorMap } from '@remix-run/data-schema';
export type ValidatableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export interface FieldState {
    readonly errors: ReadonlyArray<string>;
    readonly touched: boolean;
}
export interface FieldFeedback {
    touched: boolean;
    hasServerErrors: boolean;
    errors: ReadonlyArray<string>;
    customErrors: ReadonlyArray<string>;
    customValue?: string;
    refreshControl?: () => void;
}
export interface FieldMixinConfig {
    attrs: Record<string, unknown>;
    validate(control: ValidatableControl): void;
    field: string;
    errorMap?: ErrorMap;
    errorId: string;
    feedback: FieldFeedback;
    onFeedbackChange(previous: FieldState): void;
}
declare const INPUT_VALIDATION_EVENT: 'rmx:input-validation';
declare global {
    interface HTMLElementEventMap {
        [INPUT_VALIDATION_EVENT]: InputValidationEvent;
    }
}
/** Presentation-ready validation state for a model-backed input. */
export interface InputValidationState extends FieldState {
    /** The projected field name, independent of an overridden input name or id. */
    readonly field: string;
    /** The generated id to apply to the application's error element. */
    readonly errorId: string;
}
/** A bubbling notification for rendering application-owned field errors. */
export declare class InputValidationEvent extends Event implements InputValidationState {
    /** The projected field name. */
    readonly field: string;
    /** The id of the application's error element. */
    readonly errorId: string;
    /** The errors to display for this field. */
    readonly errors: ReadonlyArray<string>;
    /** Whether client feedback has been revealed for this input. */
    readonly touched: boolean;
    /**
     * Creates a validation notification.
     *
     * @param state The field's presentation-ready validation state.
     */
    constructor(state: InputValidationState);
}
export declare const formValidity: import("@remix-run/component").MixinFactory<HTMLFormElement, [], ElementProps>;
export declare const fieldValidity: import("@remix-run/component").MixinFactory<ValidatableControl, [getConfig: () => FieldMixinConfig], ElementProps>;
/**
 * Observes field feedback without taking ownership of its markup or disabling default behavior.
 *
 * @param handler Receives the field, error element id, visible errors, and touched state.
 * @param captureBoolean Whether to listen during capture (false by default).
 * @returns An event mixin for an input or an ancestor such as its form.
 */
export declare function onInputValidation<target extends HTMLElement>(handler: (event: Dispatched<InputValidationEvent, target>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean): ReturnType<typeof on<target, typeof INPUT_VALIDATION_EVENT>>;
export {};
