import path from "path";
import type * as esbuild from "esbuild";

import { BuildMode, BuildTarget } from "../build";
import type { BuildOptions } from "../build";
import { build } from "../compiler";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";

// Mock ESM-only modules as these are not well-supported in
// the Jest environment available.
jest.mock("xdm", () => ({
  __esModule: true,
  compile: () => ({}),
}));
jest.mock("remark-frontmatter", () => ({
  __esModule: true,
}));
jest.mock("tsconfig-paths", () => ({
  __esModule: true,
  default: {
    loadConfig() {
      return {
        resultType: "failed",
      };
    },
  },
}));

// a simple app that does not use ESM
const remixRoot = path.resolve(__dirname, "./fixtures/simple-app");
// a simple app like above, expect has a custom "jsxImportSource"
const customJSXAppRoot = path.resolve(__dirname, "./fixtures/custom-jsx-app");

const expectedBuildFiles = [
  "public/build/entry.client-*.js",
  "public/build/root-*.js",
  "public/build/routes/index-*.js",
  "public/build/_shared/chunk-*.js",
  "build/index.js",
];

async function generateBuild(config: RemixConfig, options: BuildOptions) {
  return await build(config, { ...options, write: false });
}

function getFilenames(output: (esbuild.BuildResult | undefined)[]) {
  return output.flatMap(({ outputFiles }) =>
    outputFiles.map(({ path: outputPath }) =>
      path.relative(remixRoot, outputPath)
    )
  );
}

/**
 * Checks that the esbuild output has the specified files, with
 * "*" acting as a wildcard, e.g., for hashes.
 */
function expectBuildToHaveFiles(
  output: (esbuild.BuildResult | undefined)[],
  files: string[]
) {
  expect(getFilenames(output)).toEqual(
    expect.arrayContaining(
      files.map((string) =>
        expect.stringMatching(
          new RegExp(
            `^${string.replace(/\//g, "\\/").replace(/\*/g, "[^/]+")}$`
          )
        )
      )
    )
  );
}

/**
 * Runs the build output with mocked require-resolving and returns
 * the mocked "module" object.
 */
function runBuildOutput(
  text: string,
  modules: Record<string, unknown> = {},
  additionalArguments: Record<string, unknown> = {}
) {
  let module = { exports: {} } as {
    exports: { [key: string]: unknown };
  };

  // eslint-disable-next-line no-new-func
  new Function("require", "module", ...Object.keys(additionalArguments), text)(
    (moduleName: string) => modules[moduleName] ?? {},
    module,
    ...Object.values(additionalArguments)
  );

  return { module };
}

describe("building", () => {
  let config: RemixConfig;
  beforeAll(async () => {
    config = await readConfig(remixRoot);
  });

  beforeEach(() => {
    jest.setTimeout(20000);
  });

  describe("the development build", () => {
    it("generates the correct bundles", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Development,
        target: BuildTarget.Node14,
      });

      expectBuildToHaveFiles(output, expectedBuildFiles);
    });

    it('calls the JSX custom factory with a custom "jsxImportSource"', async () => {
      let buildOutput = await generateBuild(
        await readConfig(customJSXAppRoot),
        {
          mode: BuildMode.Development,
        }
      );

      let jsxFn = jest.fn();
      let { module } = runBuildOutput(
        buildOutput[1].outputFiles[0].text,
        {},
        { jestFn: jsxFn }
      );

      expect(module.exports).toHaveProperty(
        "routes.routes/index.module.default"
      );

      let indexRouteModule =
        module.exports.routes["routes/index"].module.default;
      expect(typeof indexRouteModule).toBe("function");

      indexRouteModule();

      expect(jsxFn).toBeCalledWith("div", null);
    });

    it('calls the default React factory without a "jsxImportSource"', async () => {
      let buildOutput = await generateBuild(config, {
        mode: BuildMode.Development,
      });

      let jsxFn = jest.fn();
      let { module } = runBuildOutput(buildOutput[1].outputFiles[0].text, {
        react: {
          createElement: jsxFn,
        },
      });

      expect(module.exports).toHaveProperty(
        "routes.routes/index.module.default"
      );

      let indexRouteModule =
        module.exports.routes["routes/index"].module.default;
      expect(typeof indexRouteModule).toBe("function");

      indexRouteModule();

      expect(jsxFn).toBeCalledWith("div", null);
    });
  });

  describe("the production build", () => {
    it("generates the correct bundles", async () => {
      let output = await generateBuild(config, {
        mode: BuildMode.Production,
      });

      expectBuildToHaveFiles(output, expectedBuildFiles);
    });
  });
});
