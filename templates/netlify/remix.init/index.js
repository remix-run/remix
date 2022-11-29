const inquirer = require("inquirer");
const fs = require("fs/promises");
const { join } = require("path");
const PackageJson = require("@npmcli/package-json");

const { USE_NETLIFY_EDGE } = process.env;

const filesToCopy = [
  ["README.md"],
  ["netlify.toml"],
  ["server.js"],
  ["remix.config.js"],
  ["vscode.json", join(".vscode", "settings.json")],
];

const filesToModify = ["app/entry.server.tsx", "app/root.tsx"];

async function modifyFilesForEdge(files, rootDirectory) {
  const filePaths = files.map((file) => join(rootDirectory, file));
  const contents = await Promise.all(
    filePaths.map((path) => fs.readFile(path, "utf8"))
  );

  await Promise.all(
    contents.map((content, index) => {
      const newContent = content.replace(
        /@remix-run\/node/g,
        "@remix-run/deno"
      );
      return fs.writeFile(filePaths[index], newContent);
    })
  );
}

async function copyEdgeTemplateFiles(files, rootDirectory) {
  for (const [file, target] of files) {
    await fs.copyFile(
      join(rootDirectory, "remix.init", file),
      join(rootDirectory, target || file)
    );
  }
}

async function updatePackageJsonForEdge(directory) {
  const packageJson = await PackageJson.load(directory);
  const {
    dependencies: {
      "@remix-run/netlify": _netlify,
      "@remix-run/node": _node,
      ...dependencies
    },
    scripts,
    ...restOfPackageJson
  } = packageJson.content;

  packageJson.update({
    // dev script is the same as the start script for Netlify Edge, "cross-env NODE_ENV=production netlify dev"
    scripts: { ...scripts, dev: scripts["start"] },
    ...restOfPackageJson,
    dependencies: { ...dependencies, "@remix-run/netlify-edge": "*" },
  });

  await packageJson.save();
}

async function main({ rootDirectory }) {
  if (!(await shouldUseEdge())) {
    return;
  }

  await Promise.all([
    fs.mkdir(join(rootDirectory, ".vscode")),
    copyEdgeTemplateFiles(filesToCopy, rootDirectory),
  ]);

  await Promise.all([
    modifyFilesForEdge(filesToModify, rootDirectory),
    updatePackageJsonForEdge(rootDirectory),
  ]);
}

async function shouldUseEdge() {
  if (USE_NETLIFY_EDGE) {
    // Skip the prompt if we're running in CI for Netlify Edge
    return true;
  }

  const { edge } = await inquirer.prompt([
    {
      name: "edge",
      type: "list",
      message: "Run your Remix site with:",
      choices: [
        {
          name: "Netlify Functions - Choose this for stable support for production sites",
          value: false,
        },
        {
          name: "Netlify Edge Functions (beta) - Try this for improved performance on non-critical sites",
          value: true,
        },
      ],
    },
  ]);
  return edge;
}

module.exports = main;
