import { test, expect } from "@playwright/test";
import globby from "globby";
import fs from "fs";
import path from "path";

import { createFixtureProject, js, css } from "./helpers/create-fixture";

test("builds deterministically under different paths", async () => {
  // This test validates various flavors of remix virtual modules to ensure
  // we get identical builds regardless of the parent paths. If a virtual
  // module resolves or imports from absolute paths (e.g. via `path.resolve`),
  // the build hashes may change even though the output is identical. This
  // can cause broken apps (i.e. manifest mismatch) if the server and client
  // are built separately.

  // Virtual modules tested:
  //  * browserRouteModulesPlugin (implicitly tested by root route)
  //  * cssEntryModulePlugin (implicitly tested by build)
  //  * cssModulesPlugin (via app/routes/foo.tsx' CSS Modules import)
  //  * cssSideEffectImportsPlugin (via app/routes/foo.tsx' CSS side-effect import)
  //  * emptyModulesPlugin (via app/routes/foo.tsx' server import)
  //  * mdx (via app/routes/index.mdx)
  //  * serverAssetsManifestPlugin (implicitly tested by build)
  //  * serverEntryModulePlugin (implicitly tested by build)
  //  * serverRouteModulesPlugin (implicitly tested by build)
  let init = {
    files: {
      "remix.config.js": js`
        module.exports = {
          future: {
            unstable_cssModules: true,
            unstable_cssSideEffectImports: true,
          },
        };
      `,
      "app/routes/index.mdx": "# hello world",
      "app/routes/foo.tsx": js`
        export * from "~/foo/bar.server";
        import styles from "~/styles/foo.module.css";
        import "~/styles/side-effect.css";
        export default () => <div className={styles.foo}>YAY</div>;
      `,
      "app/foo/bar.server.ts": "export const meta = () => []",
      "app/styles/foo.module.css": css`
        .foo {
          background-image: url(~/images/foo.svg);
          composes: bar from "~/styles/bar.module.css";
          composes: baz from "./baz.module.css";
        }
      `,
      "app/styles/bar.module.css": css`
        .bar {
          background-color: peachpuff;
        }
      `,
      "app/styles/baz.module.css": css`
        .baz {
          color: coral;
        }
      `,
      "app/images/foo.svg": `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="coral" />
        </svg>
      `,
      "app/styles/side-effect.css": css`
        .side-effect {
          color: mintcream;
        }
      `,
    },
  };
  let dir1 = await createFixtureProject(init);
  let dir2 = await createFixtureProject(init);

  expect(dir1).not.toEqual(dir2);

  let files1 = await globby(["build/index.js", "public/build/**/*.{js,css}"], {
    cwd: dir1,
  });
  files1 = files1.sort();
  let files2 = await globby(["build/index.js", "public/build/**/*.{js,css}"], {
    cwd: dir2,
  });
  files2 = files2.sort();

  expect(files1.length).toBeGreaterThan(0);
  expect(files1).toEqual(files2);
  files1.forEach((file, i) => {
    expect(fs.readFileSync(path.join(dir1, file))).toEqual(
      fs.readFileSync(path.join(dir2, files2[i]))
    );
  });
});
