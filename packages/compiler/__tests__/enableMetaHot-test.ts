import babelTransform from "../babelTransform";
import { enableMetaHot } from "../babelPlugins";

async function transform(
  source: string,
  hmrClientModuleId?: string
): Promise<string> {
  let result = await babelTransform(source, {
    configFile: false,
    plugins: [enableMetaHot(hmrClientModuleId)]
  });

  return result.code;
}

describe("enableMetaHot", () => {
  it("adds the HMR code import when `import.meta.hot` is used", async () => {
    let source = `
    console.log(import.meta.url);
    if (import.meta.hot) {
      import.meta.hot.accept();
    }
    `;

    let result = await transform(source);

    expect(result).toMatchInlineSnapshot(`
      "import * as __hmr_client__ from \\"__HMR_CLIENT_MODULE_ID__\\";
      import.meta.hot = __hmr_client__.createHotContext(import.meta.url);
      console.log(import.meta.url);

      if (import.meta.hot) {
        import.meta.hot.accept();
      }"
    `);
  });

  it("does not add the HMR code import when `import.meta.hot` is not used", async () => {
    let source = `
    console.log(import.meta.url);
    `;

    let result = await transform(source);

    expect(result).toMatchInlineSnapshot(`"console.log(import.meta.url);"`);
  });
});
