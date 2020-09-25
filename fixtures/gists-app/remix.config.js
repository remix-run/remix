const path = require("path");
const fs = require("fs").promises;

exports.appDirectory = "./app";
exports.browserBuildDirectory = "./public/build";
exports.dataDirectory = "./data";
exports.publicPath = "/build/";
exports.serverBuildDirectory = "./build";

exports.devServerPort = 8002;

// custom routes
exports.routes = async function (defineRoutes) {
  // test that it waits for the config
  // await new Promise(res => setTimeout(res, 5000));
  let pages = await fs.readdir(path.join(__dirname, "app", "pages"));

  return defineRoutes(route => {
    // create some custom routes from the pages/ dir
    for (let page of pages) {
      let path = `/page/${page.replace(/\.js$/, "")}`;
      route(path, `pages/${page}`);
    }
  });
};
