const fsp = require("fs").promises;
const path = require("path");

/**
 * @type {import("@remix-run/dev/config").AppConfig}
 */
module.exports = {
  appDirectory: "./app",
  publicBuildDirectory: "./public/build",
  publicPath: "/build/",
  serverBuildDirectory: "./build",
  devServerPort: 8002,

  mdx: async filename => {
    const [rehypeHighlight, remarkToc] = await Promise.all([
      import("rehype-highlight").then(mod => mod.default),
      import("remark-toc").then(mod => mod.default)
    ]);

    return {
      remarkPlugins: [remarkToc],
      rehypePlugins: [rehypeHighlight]
    };
  },

  // custom routes
  routes: async defineRoutes => {
    let pages = await fsp.readdir(path.join(__dirname, "app", "pages"));

    return defineRoutes(route => {
      // create some custom routes from the pages/ dir
      for (let page of pages) {
        // skip MDX pages for now...
        if (page.endsWith(".mdx")) continue;

        let slug = page.replace(/\.[a-z]+$/, "");
        route(`/page/${slug}`, `pages/${page}`);
      }

      route("programmatic", "pages/test.jsx", () => {
        // route("/test", "routes/blog/index.tsx", { index: true });
        route(":messageId", "pages/child.jsx");
      });
    });
  }
};
