import picomatch from "picomatch";

interface CacheValue {
  value: string;
  fileDependencies: Set<string>;
  globDependencies: Set<string>;
}

export interface FileWatchCache {
  get(key: string): Promise<CacheValue> | undefined;
  getOrSet(
    key: string,
    lazySetter: () => Promise<CacheValue>
  ): Promise<CacheValue>;
  set(key: string, promise: Promise<CacheValue>): Promise<CacheValue>;
  invalidateFile(path: string): void;
}

const globMatchers = new Map<string, ReturnType<typeof picomatch>>();
function getGlobMatcher(glob: string) {
  let matcher = globMatchers.get(glob);

  if (!matcher) {
    matcher = picomatch(glob);
    globMatchers.set(glob, picomatch(glob));
  }

  return matcher;
}

export function createFileWatchCache(): FileWatchCache {
  let promiseForCacheKey = new Map<string, Promise<CacheValue>>();

  let fileDepsForCacheKey = new Map<string, Set<string>>();
  let cacheKeysForFileDep = new Map<string, Set<string>>();

  // Glob dependencies are primarily here to support Tailwind.
  // Tailwind directives like `@tailwind utilities` output a bunch of
  // CSS that changes based on the usage of class names in any file matching
  // the glob specified in the `content` array in the Tailwind config, so those
  // globs becomes a dependency of any CSS file using these directives.
  let globDepsForCacheKey = new Map<string, Set<string>>();
  let cacheKeysForGlobDep = new Map<string, Set<string>>();

  function invalidateCacheKey(invalidatedCacheKey: string): void {
    // If it's not a cache key (or doesn't have a cache entry), bail out
    if (!promiseForCacheKey.has(invalidatedCacheKey)) {
      return;
    }

    promiseForCacheKey.delete(invalidatedCacheKey);

    // Reset tracked deps for entry point. Since we're going to recompile,
    // the cache key will get new deps.
    let fileDeps = fileDepsForCacheKey.get(invalidatedCacheKey);
    if (fileDeps) {
      for (let fileDep of fileDeps) {
        cacheKeysForFileDep.get(fileDep)?.delete(invalidatedCacheKey);
      }
      fileDepsForCacheKey.delete(invalidatedCacheKey);
    }

    // Reset tracked glob dependencies for entry point. Since we're going to
    // recompile, the cache key will get new glob dependencies.
    let globDeps = globDepsForCacheKey.get(invalidatedCacheKey);
    if (globDeps) {
      for (let glob of globDeps) {
        cacheKeysForGlobDep.get(glob)?.delete(invalidatedCacheKey);
      }
      globDepsForCacheKey.delete(invalidatedCacheKey);
    }
  }

  function invalidateFile(invalidatedFile: string): void {
    console.log("Invalidate file", { invalidatedFile });

    // Invalidate all cache entries that depend on the file.
    let cacheKeys = cacheKeysForFileDep.get(invalidatedFile);
    if (cacheKeys) {
      for (let cacheKey of cacheKeys) {
        console.log("Invalidate cache key for file dep", {
          invalidatedFile,
          cacheKey,
        });

        invalidateCacheKey(cacheKey);
      }
    }

    // Invalidate all cache entries that depend on a glob that matches the file.
    // Any glob could match the file, so we have to check all globs.
    for (let [glob, cacheKeys] of cacheKeysForGlobDep) {
      let match = getGlobMatcher(glob);
      if (match && match(invalidatedFile)) {
        for (let cacheKey of cacheKeys) {
          console.log("Invalidate cache key for glob match", {
            glob,
            invalidatedFile,
            cacheKey,
          });

          invalidateCacheKey(cacheKey);
        }
      }
    }
  }

  function get(key: string): Promise<CacheValue> | undefined {
    return promiseForCacheKey.get(key);
  }

  function getOrSet(
    key: string,
    lazySetter: () => Promise<CacheValue>
  ): Promise<CacheValue> {
    return promiseForCacheKey.get(key) || set(key, lazySetter());
  }

  function set(key: string, promise: Promise<CacheValue>): Promise<CacheValue> {
    promiseForCacheKey.set(key, promise);

    promise.then(({ fileDependencies, globDependencies }) => {
      if (promiseForCacheKey.get(key) !== promise) {
        // This cache key was invalidated before the promise resolved.
        return;
      }

      // Track file dependencies for this entry point.
      let fileDeps = fileDepsForCacheKey.get(key);
      if (!fileDeps) {
        fileDeps = new Set();
        fileDepsForCacheKey.set(key, fileDeps);
      }
      for (let fileDep of fileDependencies) {
        fileDeps.add(fileDep);

        let cacheKeys = cacheKeysForFileDep.get(fileDep);
        if (!cacheKeys) {
          cacheKeys = new Set();
          cacheKeysForFileDep.set(fileDep, cacheKeys);
        }
        cacheKeys.add(key);
      }

      // Track glob dependencies for this entry point.
      let globDeps = globDepsForCacheKey.get(key);
      if (!globDeps) {
        globDeps = new Set();
        globDepsForCacheKey.set(key, globDeps);
      }
      for (let glob of globDependencies) {
        globDeps.add(glob);

        let cacheKeys = cacheKeysForGlobDep.get(glob);
        if (!cacheKeys) {
          cacheKeys = new Set();
          cacheKeysForGlobDep.set(glob, cacheKeys);
        }
        cacheKeys.add(key);
      }
    });

    return promise;
  }

  return {
    get,
    getOrSet,
    set,
    invalidateFile,
  };
}
