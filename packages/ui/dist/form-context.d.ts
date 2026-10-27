import type { ElementProps, Handle, RemixNode } from '@remix-run/component';
import type { FormEntries, FormField, FormFieldKind, FormSchema, FormErrors, FormSubmission } from '@remix-run/data-schema/form';
import type { FieldFeedback, FieldState, ValidatableControl } from './form-control.ts';
/** A live form field reference that can be passed to child components through props. */
export interface FieldBinding<kind extends string = FormFieldKind> {
    /** The field's form decoding kind. */
    readonly kind: kind;
    /** The submitted HTML name. */
    readonly name: string;
    /** The context-scoped native control ID. */
    readonly id: string;
    /** The context-scoped error element ID. */
    readonly errorId: string;
    /** Visible client errors or immediate server errors; read during rendering. */
    readonly errors: ReadonlyArray<string>;
    /** Whether blur, invalid submission, or editing server feedback revealed client errors. */
    readonly touched: boolean;
    /**
     * Replaces supplemental errors for the current control value without marking it touched.
     * @param messages Supplemental messages; an empty array clears them.
     */
    setCustomErrors(messages: ReadonlyArray<string>): void;
}
/** Typed bindings retaining the form kind of each submitted entry. */
export type FieldBindings<entries extends FormEntries> = {
    readonly [key in keyof entries]: FieldBinding<entries[key] extends FormField<unknown, infer kind> ? kind : entries[key]['kind']>;
};
/** Current field references and grouped server errors for the render callback. */
export interface FormContextValue<entries extends FormEntries> {
    /** Stable typed field bindings; read live properties during rendering. */
    fields: FieldBindings<entries>;
    /** Current grouped server messages, including form-level business errors. */
    errors: FormErrors;
}
/** One rendered form's shared schema and current submission. */
export interface FormContextProps<entries extends FormEntries> {
    /** Initial unique ID scope. Pass a client entry's handle.id to retain exact SSR IDs on hydration. */
    id?: string;
    /** Stable inspectable form schema, also used by server parsing. */
    schema: FormSchema<entries>;
    /** A new submission object resets feedback and refreshes failed values. */
    submission?: FormSubmission;
    /** Renders application-owned markup with live fields and errors. */
    children(value: FormContextValue<entries>): RemixNode;
}
interface FormContextState {
    getSubmission(): FormSubmission | undefined;
    changed(previous: FieldState, current: FieldFeedback): void;
}
/**
 * Owns a form instance's feedback and renders fields without setup factories or subscriptions.
 * @param handle Shared schema, submission props, component lifetime, and render callback.
 * @returns The application's form markup with live field bindings.
 */
export declare function Context<entries extends FormEntries>(handle: Handle<FormContextProps<entries>, FormContextState>): () => RemixNode;
/** Native form coordination without intercepting submission or owning navigation. */
export declare const root: import("@remix-run/component").MixinFactory<HTMLFormElement, [], ElementProps>;
/** Native control validation, constraints, restored values, feedback, and error associations. */
export declare const control: import("@remix-run/component").MixinFactory<ValidatableControl, [field: FieldBinding<FormFieldKind>], ElementProps>;
/** Associates an application-owned label with a field's scoped control. */
export declare const label: import("@remix-run/component").MixinFactory<HTMLLabelElement, [field: FieldBinding<string>], ElementProps>;
/** Identifies application-owned error content without choosing its role or visibility. */
export declare const error: import("@remix-run/component").MixinFactory<Element, [field: FieldBinding<string>], ElementProps>;
export {};
