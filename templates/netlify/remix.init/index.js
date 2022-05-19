const inquirer = require("inquirer");
const fs = require("fs/promises");
const { join } = require("path");
const sortPackageJson = require("sort-package-json");

const filesToCopy = [
  ["README.md"],
  ["netlify.toml"],
  ["edge-server.js", "server.js"],
  ["remix.config-edge.js", "remix.config.js"],
  ["vscode.json", join(".vscode", "settings.json")],
];

const filesToModify = ["app/entry.server.tsx", "app/root.tsx"];

async function modifyFilesForEdge(files, rootDirectory) {
  let filePaths = files.map((file) => join(rootDirectory, file));
  let contents = await Promise.all(filePaths.map(fs.readFile));

  await Promise.all(
    contents.map((content, index) => {
      let newContent = content.replace(/@remix-run\/node/g, "@remix-run/deno");
      return fs.WriteFile(filePaths[index], newContent);
    })
  );
}

async function copyEdgeTemplateFiles(files, rootDirectory) {
  for (let [file, target] of files) {
    await fs.copyFile(
      join(rootDirectory, "remix.init", file),
      join(rootDirectory, target || file)
    );
  }
}

async function updatePackageJsonForEdge(filepath) {
  let { dependencies, ...restOfPackageJson } = JSON.parse(
    await fs.readFile(filepath, "utf-8")
  );

  delete dependencies["@remix-run/netlify"];
  dependencies["@remix-run/netlify-edge"] = "*";

  let newPackageJson = {
    ...restOfPackageJson,
    dependencies,
  };

  await fs.writeFile(
    filepath,
    JSON.stringify(sortPackageJson(newPackageJson), null, 2) + "\n"
  );
}

async function main({ rootDirectory }) {
  if (await shouldUseEdge()) {
    await fs.mkdir(join(rootDirectory, ".vscode"));

    await copyEdgeTemplateFiles(filesToCopy, rootDirectory);
    await modifyFilesForEdge(filesToModify, rootDirectory);
    await updatePackageJsonForEdge(join(rootDirectory, "package.json"));
  }
}

async function shouldUseEdge() {
  let { edge } = await inquirer.prompt([
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
