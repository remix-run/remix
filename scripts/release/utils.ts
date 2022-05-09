import { GITHUB_REPOSITORY } from "./constants";

export function checkIfStringStartsWith(
  string: string,
  substrings: Array<string>
): boolean {
  return substrings.some((substr) => string.startsWith(substr));
}

export interface MinimalTag {
  tag: string;
  date: Date;
  isPrerelease: boolean;
}

export function sortByDate(a: MinimalTag, b: MinimalTag) {
  return b.date.getTime() - a.date.getTime();
}

export function getGitHubUrl(type: "pull" | "issue", number: number) {
  let segment = type === "pull" ? "pull" : "issues";
  return `https://github.com/${GITHUB_REPOSITORY}/${segment}/${number}`;
}
