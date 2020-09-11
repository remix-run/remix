const path = require("path");
const fs = require("fs").promises;

exports.loadersDirectory = "./loaders";
exports.serverBuildDirectory = "./build";
exports.clientBuildDirectory = "./public/build";
exports.clientPublicPath = "/build/";

exports.devServerPort = 8002;

// custom routes
exports.routes = async function (defineRoutes) {
  // test that it waits for the config
  // await new Promise(res => setTimeout(res, 5000));
  let pages = await fs.readdir(path.join(__dirname, "src", "pages"));

  return defineRoutes(route => {
    // create some custom routes from the pages/ dir
    for (let page of pages) {
      let path = `/page/${page.replace(/\.js$/, "")}`;
      route(path, `pages/${page}`);
    }
  });
};
