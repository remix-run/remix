import type { FrameContent, FrameResolution } from './component.ts';
export declare function unwrapFrameResolution(resolution: FrameResolution): Promise<{
    content: FrameContent;
    redirectedTo?: string;
}>;
