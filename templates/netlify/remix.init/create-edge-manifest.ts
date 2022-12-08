import fse from "fs-extra";
import path from "path";
import { readConfig } from "@remix-run/dev/dist/config";

(async () => {
  const { serverBuildPath } = await readConfig();
  const edgeManifest = {
    functions: [{ function: "server", path: "/*" }],
    version: 1,
  };
  const edgeDir = path.dirname(serverBuildPath);

  fse.ensureDirSync(edgeDir);
  fse.writeJSONSync(path.join(edgeDir, "manifest.json"), edgeManifest);
})();
