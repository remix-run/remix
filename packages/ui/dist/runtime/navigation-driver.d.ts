import type { NavigationState } from './navigation.ts';
export interface NavigationDriver {
    navigate(href: string, state: NavigationState, history: 'push' | 'replace' | undefined): Promise<void>;
}
export declare function setNavigationDriver(signal: AbortSignal, driver: NavigationDriver): void;
export declare function getNavigationDriver(): NavigationDriver | undefined;
