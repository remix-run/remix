// Frames only render on the website. The markdown version of a chapter (`/<chapter>.md`
// on the site, and the guides copied into the `remix` package for agents) replaces each
// `::frame` with the file at the `sourceUrl` its handler declares, as a `tsx` code block.
// Frames whose handler declares no fallback are stripped.
export type MarkdownFallback = { sourceUrl: URL };

const markdownFallbacks = new WeakMap<Function, MarkdownFallback>();

export function setMarkdownFallback(handler: Function, fallback: MarkdownFallback): void {
  markdownFallbacks.set(handler, fallback);
}

export function getMarkdownFallback(handler: unknown): MarkdownFallback | undefined {
  return typeof handler === "function" ? markdownFallbacks.get(handler) : undefined;
}
