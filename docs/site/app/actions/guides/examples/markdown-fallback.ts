// Frames only render on the website. The markdown version of a chapter (`/<chapter>.md`
// on the site, and the guides copied into the `remix` package for agents) replaces each
// `::frame` with the fallback its handler declares: the file at `sourceUrl` as a `tsx`
// code block, or `markdown` as written. Frames whose handler declares no fallback are
// stripped.
export type MarkdownFallback = { sourceUrl: URL } | { markdown: string };

const markdownFallbacks = new WeakMap<Function, MarkdownFallback>();

export function setMarkdownFallback(handler: Function, fallback: MarkdownFallback): void {
  markdownFallbacks.set(handler, fallback);
}

export function getMarkdownFallback(handler: unknown): MarkdownFallback | undefined {
  return typeof handler === "function" ? markdownFallbacks.get(handler) : undefined;
}
