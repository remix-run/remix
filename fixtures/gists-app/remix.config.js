const fsp = require("fs").promises;
const path = require("path");

exports.appDirectory = "./app";
exports.publicBuildDirectory = "./public/build";
exports.publicPath = "/build/";
exports.serverBuildDirectory = "./build";
exports.devServerPort = 8002;

// custom routes
exports.routes = async function (defineRoutes) {
  let pages = await fsp.readdir(path.join(__dirname, "app", "pages"));

  return defineRoutes(route => {
    // create some custom routes from the pages/ dir
    for (let page of pages) {
      // skip MDX pages for now...
      if (page.endsWith(".mdx")) continue;

      let slug = page.replace(/\.[a-z]+$/, "");
      route(`/page/${slug}`, `pages/${page}`);
    }
  });
};
