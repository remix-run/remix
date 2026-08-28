import type { FrameHandle } from './component.ts';
import type { reloadFrameForNavigation } from './frame.ts';
import type { NavigationState } from './navigation.ts';
export interface FormSubmission {
    formData: FormData | undefined;
    method: string;
    encType: string;
}
export interface NavigationFrameOptions {
    getTopFrame(): FrameHandle;
    getNamedFrame(name: string): FrameHandle | undefined;
    reloadFrame(frame: FrameHandle, options?: Parameters<typeof reloadFrameForNavigation>[1]): ReturnType<typeof reloadFrameForNavigation>;
}
export interface NavigationFrameResult {
    frame: FrameHandle;
    topFrame: FrameHandle;
    redirectedTo: string | undefined;
}
export declare function reloadNavigationFrame(destination: string, state: NavigationState, signal: AbortSignal, submission: FormSubmission | undefined, options: NavigationFrameOptions): Promise<NavigationFrameResult>;
