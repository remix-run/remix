import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

import { createFixtureProject, js, json } from "./helpers/create-fixture.js";

test.describe("", () => {
  for (let [serverModuleExt, serverModuleFormat, exportStatement] of [
    ["mjs", "esm", "export {"],
    ["cjs", "cjs", "module.exports ="],
  ]) {
    test(`can write .${serverModuleExt} server output module`, async () => {
      let projectDir = await createFixtureProject({
        files: {
          // Ensure the config is valid ESM
          "remix.config.js": js`
            export default {
              serverModuleFormat: "${serverModuleFormat}",
              serverBuildPath: "build/index.${serverModuleExt}",
            };
          `,
          "app/routes/_index.tsx": js`
            import { json } from "@remix-run/node";
            import { useLoaderData, Link } from "@remix-run/react";

            export function loader() {
              return json("pizza");
            }

            export default function Index() {
              let data = useLoaderData();
              return (
                <div>
                  {data}
                  <Link to="/burgers">Other Route</Link>
                </div>
              )
            }
          `,
        },
      });

      let buildPath = path.resolve(
        projectDir,
        "build",
        `index.${serverModuleExt}`
      );
      expect(fs.existsSync(buildPath), "doesn't exist").toBe(true);
      let contents = fs.readFileSync(buildPath, "utf8");
      expect(contents, "no export statement").toContain(exportStatement);
    });
  }
});
