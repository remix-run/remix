/**
 * A route that was created using defineRoutes or created conventionally from
 * looking at the files on the filesystem.
 */
export interface ConfigRoute {
  path: string;
  component: string;
  loader: string | null;
  id: string;
  parentId: string | null;
  children?: ConfigRoute[];
}

interface DefineRoute {
  (
    path: string,
    // component path is relative to src/ directory
    // so src/routes/foo.js will be routes/foo.js
    // and src/articles/foo.md will be articles/foo.md
    component: string,
    // loader path is relative to loaders directory
    // so functions/loaders/foo.js will be foo.js
    loaderOrChildren?: string | (() => void),
    children?: () => void
  ): void;
}

let fileExtensionRegex = /(.*)\.([^.]+)$/;

export default function defineRoutes(
  getRoutes: (defineRoute: DefineRoute) => void
): ConfigRoute[] {
  let routes: ConfigRoute[] = [];
  let current: ConfigRoute[] = [];
  let returned = false;

  function defineRoute(
    path: string,
    component: string,
    loaderOrChildren?: string | (() => void),
    children?: () => void
  ): void {
    if (returned) throwAsyncError();

    // signature overloading
    let loader: string | null = null;
    if (typeof loaderOrChildren === "function") {
      // route(path, component, children)
      children = loaderOrChildren;
    } else if (loaderOrChildren != null) {
      // route(path, component, loader, children)
      // route(path, component, loader)
      // route(path, component)
      loader = loaderOrChildren;
    }

    let id = component.replace(fileExtensionRegex, "$1");
    let parent = current[current.length - 1];
    let route = {
      path,
      component,
      loader,
      id,
      parentId: parent ? parent.id : null
    };
    if (current.length === 0) {
      routes.push(route);
      current.push(route);
    } else {
      (parent.children || (parent.children = [])).push(route);
      current.push(route);
    }

    if (children) {
      children();
    }

    current.pop();
  }

  getRoutes(defineRoute);

  returned = true;

  return routes;
}

function throwAsyncError() {
  throw new Error(
    "You tried to define routes asynchronously but started defining routes before the async work was done. Please await all async data before calling `defineRoutes()`"
  );
}
