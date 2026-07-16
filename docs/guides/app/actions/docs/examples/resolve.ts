// Shared by the examples controller and the docs validator so they agree on what a
// valid example path looks like.

export const exampleSegmentPattern = /^[a-z0-9][a-z0-9-]*$/;

export function isExampleSegment(value: string): boolean {
  return exampleSegmentPattern.test(value);
}

export function resolveExampleModuleUrl(chapter: string, example: string): URL {
  return new URL(`./${chapter}/${example}.tsx`, import.meta.url);
}
