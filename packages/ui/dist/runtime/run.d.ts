import type { FrameHandle } from './component.ts';
import type { ComponentErrorEvent } from './error-event.ts';
import type { LoadModule, ResolveFrame } from './frame.ts';
import { TypedEventTarget } from './typed-event-target.ts';
/**
 * Options for starting the client runtime with {@link run}.
 */
export interface RunInit {
    /**
     * Loads the named browser module export for a hydrated `clientEntry()`.
     *
     * Implementations usually call dynamic `import(moduleUrl)` and return
     * `mod[exportName]`.
     */
    loadModule: LoadModule;
    /**
     * Resolves browser-loaded `<Frame>` content.
     *
     * Omit this only when the runtime never needs to load or reload frames in the
     * browser.
     */
    resolveFrame?: ResolveFrame;
}
/**
 * Events emitted by the application runtime.
 */
export type AppRuntimeEventMap = {
    error: ComponentErrorEvent;
};
/**
 * Client runtime returned by {@link run}.
 */
export type AppRuntime = TypedEventTarget<AppRuntimeEventMap> & {
    /** Resolves after the current document finishes hydrating. */
    ready(): Promise<void>;
    /** Flushes any queued component updates synchronously. */
    flush(): void;
    /** Stops runtime listeners and disposes the top-level frame. */
    dispose(): void;
};
/**
 * Returns the top-level frame handle for the running application.
 *
 * @returns The top-level frame handle.
 */
export declare function getTopFrame(): FrameHandle;
/**
 * Returns a named frame handle, falling back to the top frame when not found.
 *
 * @param name Name of the frame to look up.
 * @returns The matching frame handle or the top frame.
 */
export declare function getNamedFrame(name: string): FrameHandle;
/**
 * Starts the client-side Remix component runtime for the current document.
 *
 * @param init Runtime hooks for loading modules and resolving frames.
 * @returns The running application runtime.
 */
export declare function run(init: RunInit): AppRuntime;
