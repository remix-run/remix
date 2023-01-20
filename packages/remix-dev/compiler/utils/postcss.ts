import loadConfig from "postcss-load-config";
import type { AcceptedPlugin, Processor } from "postcss";
import postcss from "postcss";

import type { RemixConfig } from "../../config";

interface Options {
  config: RemixConfig;
  vanillaExtract?: boolean;
}

function isPostcssEnabled(config: RemixConfig) {
  return config.future.unstable_postcss || config.future.unstable_tailwind;
}

function getCacheKey({ config, vanillaExtract }: Required<Options>) {
  return [config.rootDirectory, vanillaExtract].join("|");
}

let pluginsCache = new Map<string, Array<AcceptedPlugin>>();
export async function loadPostcssPlugins({
  config,
  vanillaExtract = false,
}: Options): Promise<Array<AcceptedPlugin>> {
  if (!isPostcssEnabled(config)) {
    return [];
  }

  let { rootDirectory } = config;
  let cacheKey = getCacheKey({ config, vanillaExtract });
  let cachedPlugins = pluginsCache.get(cacheKey);
  if (cachedPlugins) {
    return cachedPlugins;
  }

  let plugins: Array<AcceptedPlugin> = [];

  if (config.future.unstable_postcss) {
    try {
      let context = {
        remix: {
          vanillaExtract,
        },
      };

      let postcssConfig = await loadConfig(
        // @ts-expect-error Custom context extensions aren't type safe
        context,
        rootDirectory
      );

      plugins.push(...postcssConfig.plugins);
    } catch (err) {}
  }

  if (config.future.unstable_tailwind) {
    let tailwindPlugin = await loadTailwindPlugin(config);
    if (tailwindPlugin && !hasTailwindPlugin(plugins)) {
      plugins.push(tailwindPlugin);
    }
  }

  pluginsCache.set(cacheKey, plugins);
  return plugins;
}

let processorCache = new Map<string, Processor | null>();
export async function getPostcssProcessor({
  config,
  vanillaExtract = false,
}: Options): Promise<Processor | null> {
  if (!isPostcssEnabled(config)) {
    return null;
  }

  let cacheKey = getCacheKey({ config, vanillaExtract });
  let cachedProcessor = processorCache.get(cacheKey);
  if (cachedProcessor !== undefined) {
    return cachedProcessor;
  }

  let plugins = await loadPostcssPlugins({ config, vanillaExtract });
  let processor = plugins.length > 0 ? postcss(plugins) : null;

  processorCache.set(cacheKey, processor);
  return processor;
}

function hasTailwindPlugin(plugins: Array<AcceptedPlugin>) {
  return plugins.some(
    (plugin) =>
      "postcssPlugin" in plugin && plugin.postcssPlugin === "tailwindcss"
  );
}

let tailwindPluginCache = new Map<string, AcceptedPlugin | null>();
async function loadTailwindPlugin(
  config: RemixConfig
): Promise<AcceptedPlugin | null> {
  let { rootDirectory } = config;
  let cacheKey = rootDirectory;
  let cachedTailwindPlugin = tailwindPluginCache.get(cacheKey);
  if (cachedTailwindPlugin !== undefined) {
    return cachedTailwindPlugin;
  }

  let tailwindPlugin: AcceptedPlugin | null = null;

  try {
    // First ensure we have a Tailwind config
    require.resolve("./tailwind.config", { paths: [rootDirectory] });

    // Load Tailwind from the project directory
    let tailwindPath = require.resolve("tailwindcss", {
      paths: [rootDirectory],
    });

    let importedTailwindPlugin = (await import(tailwindPath))?.default;

    // Check that it declares itself as a PostCSS plugin
    if (importedTailwindPlugin && importedTailwindPlugin.postcss) {
      tailwindPlugin = importedTailwindPlugin;
    }
  } catch (err) {}

  tailwindPluginCache.set(cacheKey, tailwindPlugin);

  return tailwindPlugin;
}
