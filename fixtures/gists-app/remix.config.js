import { join } from "path";
import { promises as fs } from "fs";

export const paths = {
  loadersDirectory: "./loaders",
  serverBuildDirectory: "./build",
  clientBuildDirectory: "./public/build",
  clientPublicPath: "/build/"
};

export const devServer = {
  port: 8002
};

// custom routes
export async function routes(defineRoutes) {
  // test that it waits for the config
  // await new Promise(res => setTimeout(res, 5000));
  let pages = await fs.readdir(join(__dirname, "src", "pages"));

  return defineRoutes(route => {
    // create some custom routes from the pages/ dir
    for (let page of pages) {
      let path = `/page/${page.replace(/\.mdx$/, "")}`;
      route(path, `pages/${page}`);
    }
  });
}
