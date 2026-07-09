import { on } from '@remix-run/ui';
import type { Dispatched, ElementProps, MixinFactory } from '@remix-run/ui';
export interface ToggleControlOptions {
    checked?: boolean;
    defaultChecked?: boolean;
    disabled?: boolean;
    form?: string;
    inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void;
    name?: string;
    onCheckedChange?: (checked: boolean) => void;
    readOnly?: boolean;
    required?: boolean;
    tabIndex?: number;
    value?: string;
}
type ToggleChangeHandler<target extends HTMLElement> = (event: Dispatched<ToggleChangeEvent, target>, signal: AbortSignal) => void | Promise<void>;
declare const TOGGLE_CHANGE_EVENT: "rmx:toggle-change";
declare global {
    interface HTMLElementEventMap {
        [TOGGLE_CHANGE_EVENT]: ToggleChangeEvent;
    }
}
export declare class ToggleChangeEvent extends Event {
    readonly checked: boolean;
    constructor(checked: boolean);
}
export declare const control: MixinFactory<HTMLElement, [options?: ToggleControlOptions | undefined], ElementProps>;
export declare function onToggleChange<target extends HTMLElement>(handler: ToggleChangeHandler<target>, captureBoolean?: boolean): ReturnType<typeof on<target, typeof TOGGLE_CHANGE_EVENT>>;
export {};
