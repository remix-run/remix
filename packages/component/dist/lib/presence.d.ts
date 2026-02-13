import type { LayoutAnimationConfig, PresenceConfig, PresenceKeyframeConfig } from './dom.ts';
import type { CommittedHostNode, HostNode } from './vnode.ts';
export interface NormalizedPresenceProp {
    enter?: PresenceConfig | PresenceKeyframeConfig;
    exit?: PresenceConfig | PresenceKeyframeConfig;
    layout?: LayoutAnimationConfig;
}
export declare function getPresenceConfig(node: HostNode): NormalizedPresenceProp | null;
export declare function shouldPlayEnterAnimation(config: PresenceConfig | PresenceKeyframeConfig | undefined): boolean;
export declare function markNodeExiting(node: CommittedHostNode, domParent: ParentNode): void;
export declare function unmarkNodeExiting(node: CommittedHostNode): void;
export declare function playEnterAnimation(node: CommittedHostNode, config: PresenceConfig | PresenceKeyframeConfig): void;
export declare function playExitAnimation(node: CommittedHostNode, config: PresenceConfig | PresenceKeyframeConfig, domParent: ParentNode, onComplete: () => void): void;
export declare function findMatchingExitingNode(type: string, key: string | undefined, domParent: ParentNode): CommittedHostNode | null;
