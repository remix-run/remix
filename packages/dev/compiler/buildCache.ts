import cacache from "cacache";
import type { RollupCache } from "rollup";

export async function readBuildCache(
  cacheDir: string,
  cacheKey: string
): Promise<RollupCache | undefined> {
  try {
    let cached = await cacache.get(cacheDir, cacheKey);
    return JSON.parse(cached.data.toString("utf-8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  return undefined;
}

export async function writeBuildCache(
  cacheDir: string,
  cacheKey: string,
  cache: RollupCache
): Promise<void> {
  await cacache.put(cacheDir, cacheKey, JSON.stringify(cache));
}
