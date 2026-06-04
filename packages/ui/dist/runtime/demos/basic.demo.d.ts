import { type Handle } from '@remix-run/ui';
/**
 * @name Basic Counter
 * @description The smallest interactive Remix UI counter from the standalone demos.
 */
export default function App(handle: Handle): () => import("@remix-run/ui").RemixElement;
