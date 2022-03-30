import fse from "fs-extra";
import path from "path";
import { pathToFileURL } from "url";

import { execRemix, TEMP_DIR } from "./cli-utils";

describe("the create command", () => {
  let tempDirs = new Set<string>();
  afterEach(async () => {
    for (let dir of tempDirs) {
      await fse.remove(dir);
    }
    tempDirs = new Set<string>();
  });

  async function getProjectDir(name: string) {
    let tmpDir = path.join(TEMP_DIR, name);
    tempDirs.add(tmpDir);
    return tmpDir;
  }

  // this also tests sub directories
  it("works for examples in the remix repo", async () => {
    let projectDir = await getProjectDir("example");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      "examples/basic",
      "--no-install",
    ]);
    expect(stdout).toMatchInlineSnapshot(
      `"💿 That's it! \`cd\` into <TEMP_DIR>/example and check the README for development and deploy instructions!"`
    );
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for templates in the remix org", async () => {
    let projectDir = await getProjectDir("template");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      "grunge-stack",
      "--no-install",
    ]);
    expect(stdout).toMatchInlineSnapshot(`
      "💿 You've opted out of installing dependencies so we won't run the remix.init/index.js script for you just yet. Once you've installed dependencies, you can run it manually with \`npx remix init\`

      💿 That's it! \`cd\` into <TEMP_DIR>/template and check the README for development and deploy instructions!"
    `);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for GitHub username/repo combo", async () => {
    let projectDir = await getProjectDir("repo");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      "remix-fake-tester-username/remix-fake-tester-repo",
      "--no-install",
    ]);
    expect(stdout).toMatchInlineSnapshot(`
      "💿 You've opted out of installing dependencies so we won't run the remix.init/index.js script for you just yet. Once you've installed dependencies, you can run it manually with \`npx remix init\`

      💿 That's it! \`cd\` into <TEMP_DIR>/repo and check the README for development and deploy instructions!"
    `);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for remote tarballs", async () => {
    let projectDir = await getProjectDir("remote-tarball");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      "https://example.com/remix-stack.tar.gz",
      "--no-install",
    ]);
    expect(stdout).toMatchInlineSnapshot(`
      "💿 You've opted out of installing dependencies so we won't run the remix.init/index.js script for you just yet. Once you've installed dependencies, you can run it manually with \`npx remix init\`

      💿 That's it! \`cd\` into <TEMP_DIR>/remote-tarball and check the README for development and deploy instructions!"
    `);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for different branches", async () => {
    let projectDir = await getProjectDir("diff-branch");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      "https://github.com/fake-remix-tester/nested-dir/tree/dev/stack",
      "--no-install",
    ]);
    expect(stdout).toMatchInlineSnapshot(`
      "💿 You've opted out of installing dependencies so we won't run the remix.init/index.js script for you just yet. Once you've installed dependencies, you can run it manually with \`npx remix init\`

      💿 That's it! \`cd\` into <TEMP_DIR>/diff-branch and check the README for development and deploy instructions!"
    `);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for a path to a tarball on disk", async () => {
    let projectDir = await getProjectDir("local-tarball");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      path.join(__dirname, "fixtures", "arc.tar.gz"),
      "--no-install",
    ]);
    expect(stdout).toMatchInlineSnapshot(
      `"💿 That's it! \`cd\` into <TEMP_DIR>/local-tarball and check the README for development and deploy instructions!"`
    );
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for a file URL to a tarball on disk", async () => {
    let projectDir = await getProjectDir("file-url-tarball");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      pathToFileURL(path.join(__dirname, "fixtures", "arc.tar.gz")).toString(),
      "--no-install",
    ]);
    expect(stdout).toMatchInlineSnapshot(
      `"💿 That's it! \`cd\` into <TEMP_DIR>/file-url-tarball and check the README for development and deploy instructions!"`
    );
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("converts a template to javascript", async () => {
    let projectDir = await getProjectDir("template-to-js");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      "blues-stack",
      "--no-install",
      "--no-typescript",
    ]);
    expect(stdout).toMatchInlineSnapshot(`
      "💿 You've opted out of installing dependencies so we won't run the remix.init/index.js script for you just yet. Once you've installed dependencies, you can run it manually with \`npx remix init\`

      💿 That's it! \`cd\` into <TEMP_DIR>/template-to-js and check the README for development and deploy instructions!"
    `);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.jsx"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeFalsy();
    expect(fse.existsSync(path.join(projectDir, "tsconfig.json"))).toBeFalsy();
    expect(fse.existsSync(path.join(projectDir, "jsconfig.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/utils.js"))).toBeTruthy();
    let pkgJSON = JSON.parse(
      fse.readFileSync(path.join(projectDir, "package.json"), "utf-8")
    );
    expect(Object.keys(pkgJSON.devDependencies)).not.toContain("typescript");
    expect(Object.keys(pkgJSON.scripts)).not.toContain("typecheck");
  });

  it("works for a file path to a directory on disk", async () => {
    let projectDir = await getProjectDir("local-directory");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      path.join(__dirname, "fixtures/stack"),
      "--no-install",
    ]);
    expect(stdout).toMatchInlineSnapshot(`
      "💿 You've opted out of installing dependencies so we won't run the remix.init/index.js script for you just yet. Once you've installed dependencies, you can run it manually with \`npx remix init\`

      💿 That's it! \`cd\` into <TEMP_DIR>/local-directory and check the README for development and deploy instructions!"
    `);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("works for a file URL to a directory on disk", async () => {
    let projectDir = await getProjectDir("file-url-directory");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      pathToFileURL(path.join(__dirname, "fixtures/stack")).toString(),
      "--no-install",
    ]);
    expect(stdout).toMatchInlineSnapshot(`
      "💿 You've opted out of installing dependencies so we won't run the remix.init/index.js script for you just yet. Once you've installed dependencies, you can run it manually with \`npx remix init\`

      💿 That's it! \`cd\` into <TEMP_DIR>/file-url-directory and check the README for development and deploy instructions!"
    `);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
  });

  it("runs remix.init script when installing dependencies", async () => {
    let projectDir = await getProjectDir("remix-init-auto");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      path.join(__dirname, "fixtures", "successful-remix-init.tar.gz"),
      "--install",
    ]);
    let [firstLine, ...remainingLines] = stdout.split("\n");
    expect(firstLine).toMatch(/up to date, audited 1 package in \d+ms/);
    expect(remainingLines.join("\n")).toMatchInlineSnapshot(`
      "
      found 0 vulnerabilities
      💿 Running remix.init script
      💿 That's it! \`cd\` into <TEMP_DIR>/remix-init-auto and check the README for development and deploy instructions!"
    `);
    expect(stdout).toContain(`💿 Running remix.init script`);
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "test.txt"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "remix.init"))).toBeFalsy();
  });

  it("runs remix.init script when using `remix init`", async () => {
    let projectDir = await getProjectDir("remix-init-manual");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      path.join(__dirname, "fixtures", "successful-remix-init.tar.gz"),
      "--no-install",
    ]);
    expect(stdout).toMatchInlineSnapshot(`
      "💿 You've opted out of installing dependencies so we won't run the remix.init/index.js script for you just yet. Once you've installed dependencies, you can run it manually with \`npx remix init\`

      💿 That's it! \`cd\` into <TEMP_DIR>/remix-init-manual and check the README for development and deploy instructions!"
    `);

    let initResult = await execRemix(["init"], { cwd: projectDir });

    expect(initResult.stdout).toBe("");
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "test.txt"))).toBeTruthy();
    // if you run `remix init` keep around the remix.init directory for future use
    expect(fse.existsSync(path.join(projectDir, "remix.init"))).toBeTruthy();
    // deps can take a bit to install
  });

  it("throws an error when invalid remix.init script when automatically ran", async () => {
    let projectDir = await getProjectDir("invalid-remix-init-manual");
    await expect(
      execRemix([
        "create",
        projectDir,
        "--template",
        path.join(__dirname, "fixtures", "failing-remix-init.tar.gz"),
        "--install",
      ])
    ).rejects.toThrowError(`🚨 Oops, remix.init failed`);

    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
    // we should keep remix.init around if the init script fails
    expect(fse.existsSync(path.join(projectDir, "remix.init"))).toBeTruthy();
    // deps can take a bit to install
  });

  it("throws an error when invalid remix.init script when manually ran", async () => {
    let projectDir = await getProjectDir("invalid-remix-init-manual");
    let { stdout } = await execRemix([
      "create",
      projectDir,
      "--template",
      path.join(__dirname, "fixtures", "failing-remix-init.tar.gz"),
      "--no-install",
    ]);

    expect(stdout).toMatchInlineSnapshot(`
      "💿 You've opted out of installing dependencies so we won't run the remix.init/index.js script for you just yet. Once you've installed dependencies, you can run it manually with \`npx remix init\`

      💿 That's it! \`cd\` into <TEMP_DIR>/invalid-remix-init-manual and check the README for development and deploy instructions!"
    `);

    await expect(execRemix(["init"], { cwd: projectDir })).rejects.toThrowError(
      `🚨 Oops, remix.init failed`
    );
    expect(fse.existsSync(path.join(projectDir, "package.json"))).toBeTruthy();
    expect(fse.existsSync(path.join(projectDir, "app/root.tsx"))).toBeTruthy();
    // we should keep remix.init around if the init script fails
    expect(fse.existsSync(path.join(projectDir, "remix.init"))).toBeTruthy();
    // deps can take a bit to install
  });
});
