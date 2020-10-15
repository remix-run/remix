import path from "path";

export function getCacheDir(rootDirectory: string, subdir: string): string {
  return path.join(rootDirectory, ".cache", subdir);
}
