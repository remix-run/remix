// @ts-nocheck
import path from "path";
import { matchRoutes } from "react-router-dom";
import { RemixConfig } from "./readRemixConfig";

enum DataLoadStatus {
  NoMatch,
  Success,
  NotFound,
  Error
}

export async function matchAndLoadData(
  remixConfig: RemixConfig,
  url: string,
  appLoadContext: any
) {
  return {
    context: [{}, {}],
    status: DataLoadStatus.Success
  };
}

export async function matchOld({
  entry,
  url,
  loadContext,
  remixServerContext: {
    paths,
    routesConfig,
    routeEntryModules,
    webManifest,
    publicPath
  }
}) {
  let matches = matchRoutes(routesConfig, url);

  let is404 = matches.length === 1 && matches[0].route.path === "*";
  let location = createLocation(url);
  let data = await loadData({ matches, paths, loadContext, location });

  if (is404) {
    // set the 404 route path to the actual URL so that the clientside
    // `RemixNoMatch` can still work the way we need it to
    matches[0].route.path = url;
  }

  let assets = {
    meta: [],
    web: filterWebManifest(webManifest, matches)
  };

  let readEntryModule = id => routeEntryModules[id];

  let remixContext = {
    data,
    matches,
    publicPath,
    is404,
    assets,
    readEntryModule
  };

  return remixContext;
}

////////////////////////////////////////////////////////////////////////////////
function filterWebManifest(webManifest, matches) {
  let entries = ["main"].concat(
    matches.map(({ route }) => {
      return route.id;
    })
  );

  // Object.keys + reduce to an object for a quick "unique"
  let chunks = Object.keys(
    entries.reduce((chunks, entry) => {
      let entryChunks = webManifest.entrypoints[entry].js;
      for (let chunk of entryChunks) chunks[chunk] = true;
      return chunks;
    }, {})
  );

  return {
    chunks,
    "main.css": webManifest["main.css"]
  };
}

function createLocation(url) {
  // TODO: Does history/react router have something here?
  // return new URL(url, "http://example.com");
  let [pathname, search] = url.split("?");
  return { pathname, search };
}

async function loadData({ paths, matches, loadContext, location }) {
  let loaders = matches.map((match, index) => {
    if (match.route.loader === null) {
      return null;
    }

    // TODO: maybe resolve this stuff at initialization instead
    let modulePath = path.resolve(
      paths.appRoot,
      paths.loadersDirectory,
      match.route.loader
    );
    let requirePath = path.relative(__dirname, modulePath);
    return require(requirePath);
  });

  let promises = loaders.map((loader, index) => {
    if (loader === null) {
      return null;
    } else {
      let params = matches[index].params;
      return loader({ params, context: loadContext, location });
    }
  });

  let results = await Promise.all(promises);
  return results.map((data, index) => {
    return { id: matches[index].route.id, data };
  });
}

const getMeta = ({ matches, entry, location, data }) => {
  return matches.map((match, index) => {
    let mod = entry.requireModule(match.route.importPath);
    if (mod.meta) {
      let { params } = match;
      let routeData = data.find(o => o.id === match.route.id).data;
      return mod.meta({ params, data: routeData, location });
    } else {
      return null;
    }
  });
};
