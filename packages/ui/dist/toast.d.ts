import { TypedEventTarget } from '@remix-run/component';
import type { ElementProps, Handle, RemixNode } from '@remix-run/component';
/** Content published to a toast manager. */
export interface ToastOptions<data = unknown> {
    /** Stable identity. Reusing it replaces the content and options and restarts the timer. */
    id?: string;
    /** Renderable heading content. Connect its element with `title()`. */
    title?: RemixNode;
    /** Renderable supporting content. Connect its element with `description()`. */
    description?: RemixNode;
    /** Spoken text overriding the published title and description. */
    announcement?: string;
    /** Consumer-defined data interpreted by the renderer. */
    data?: data;
    /** Auto-dismiss timeout in milliseconds, or false to disable. Zero dismisses immediately. Falls back to the manager default, or false. */
    timeout?: number | false;
}
/** Default policy for notifications published through a manager. */
export interface ToastManagerOptions<data = unknown> {
    /** Fallback timeout in milliseconds, or false to disable. A callback resolves it once per add without an explicit timeout. Defaults to false. */
    defaultTimeout?: number | false | ((options: ToastOptions<data>) => number | false);
}
/** An immutable toast item snapshot. Read the manager again for the current remaining time. */
export interface ToastItem<data = unknown> {
    /** Stable identity, including generated identities. */
    readonly id: string;
    /** Starts at zero and increments on each duplicate add, even with unchanged content. */
    readonly revision: number;
    /** Visible heading. */
    readonly title?: RemixNode;
    /** Supporting content. */
    readonly description?: RemixNode;
    /** Optional spoken text overriding the published title and description. */
    readonly announcement?: string;
    /** Content interpreted by the consumer's renderer. */
    readonly data?: data;
    /** Configured timeout in milliseconds, or false for a persistent toast. */
    readonly timeout: number | false;
    /** Remaining time in milliseconds, or zero when persistent. Sampled when this snapshot was read. */
    readonly remaining: number;
    /** Whether the timer is stopped, including while no item presents the toast. */
    readonly paused: boolean;
    /** Whether at least one mounted item presents this toast. */
    readonly presented: boolean;
}
/** Commands and observable state, without a bound component. Events signal that state can be read. */
export interface ToastManager<data = unknown> extends TypedEventTarget<{
    change: Event;
}> {
    /** Open toast items, newest first. Updating an existing identity preserves its position. */
    readonly toastItems: readonly ToastItem<data>[];
    /** Adds or replaces a toast by identity. Omitted fields clear or use defaults. Returns its identity. */
    add(options: ToastOptions<data>): string;
    /** Closes one toast, or all toasts when no identity is supplied. */
    close(id?: string): void;
    /** Pauses all timers for an opaque reason. New arrivals inherit active reasons. */
    pause(reason: unknown): void;
    /** Removes just this pause reason. Other reasons continue to pause timers. */
    resume(reason: unknown): void;
    /** Presents an item for the signal's lifetime. Multiple presentations share one timer. */
    present(id: string, signal: AbortSignal): void;
}
/** Connects application-level state to consumer-owned markup. */
export interface ToastContextProps<data = unknown> {
    /** Stable manager created outside the rendering component. */
    manager: ToastManager<data>;
    /** Maximum available toast items. Unlimited by default. Must be a positive integer. */
    limit?: number;
    /** Renders every open toast item, including overflow, newest first. */
    children: (toastItems: readonly ToastItem<data>[]) => RemixNode;
}
/** Region behavior. Author its element, translated label and positioning. */
export interface ToastRootOptions {
    /** Accessible name for the notification region. */
    label: string;
    /** Unmodified key for entering and leaving the region. Defaults to F6. False disables it. */
    hotkey?: string | false;
}
/** Scopes one notification's content and controls. */
export interface ToastItemContextProps {
    /** Toast item identity from the manager. Keep the provider keyed by the same identity. */
    value: string;
    /** Consumer-owned notification markup. */
    children?: RemixNode;
}
/**
 * Creates retained toast state independently of rendering. Timers run only while presented.
 * @param options Default notification policy.
 * @returns A manager with native EventTarget subscriptions.
 */
export declare function createToastManager<data = unknown>(options?: ToastManagerOptions<data>): ToastManager<data>;
type ItemState = {
    readonly id: string;
    readonly titleId: string | undefined;
    readonly descriptionId: string | undefined;
    registerPart(part: 'title' | 'description', node: HTMLElement, signal: AbortSignal): void;
    updatePart(part: 'title' | 'description', node: HTMLElement): void;
};
/**
 * Connects retained notifications to consumer markup, announcements and focus coordination.
 * @param handle Component lifetime and typed manager props.
 * @returns A reactive renderer for the collection and announcements.
 */
export declare function Context<data = unknown>(handle: Handle<ToastContextProps<data>>): () => RemixNode;
/** A named notification region with keyboard entry. */
export declare const root: import("@remix-run/component").MixinFactory<HTMLElement, [options: ToastRootOptions], ElementProps>;
/**
 * Scopes a notification's content and controls and coordinates keyboard boundary guards.
 * @param handle Notification identity and consumer-owned markup.
 * @returns The notification's markup with shared item context.
 */
export declare function ItemContext(handle: Handle<ToastItemContextProps, ItemState>): () => RemixNode;
/** Optional presentation behavior for a toast item. */
export interface ToastItemOptions {
    /** Animates the inherited `--toast-countdown` fraction from 1 to 0. Defaults to false. */
    countdown?: boolean;
}
/**
 * Gives the scoped toast dialog semantics, presentation lifetime and focus recovery.
 * Without a title, supply an accessible name on the host with aria-label or aria-labelledby.
 */
export declare const item: import("@remix-run/component").MixinFactory<HTMLElement, [options?: ToastItemOptions | undefined], ElementProps>;
/** Connects the consumer-owned heading to the toast's accessible name. */
export declare const title: import("@remix-run/component").MixinFactory<HTMLElement, [], ElementProps>;
/** Connects the consumer-owned supporting content to the toast's accessible description. */
export declare const description: import("@remix-run/component").MixinFactory<HTMLElement, [], ElementProps>;
/** Closes the scoped toast. Supply a native button and its translated text or accessible label. */
export declare const close: import("@remix-run/component").MixinFactory<HTMLButtonElement, [], ElementProps>;
export {};
