const inquirer = require("inquirer");
const fs = require("fs/promises");
const { join } = require("path");
const PackageJson = require("@npmcli/package-json");

const filesToCopy = [
  ["README.md"],
  ["netlify.toml"],
  ["edge-server.js", "server.js"],
  ["remix.config-edge.js", "remix.config.js"],
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
  const { dependencies, scripts, ...restOfPackageJson } = packageJson.content;

  // Replaces remix dev since there is no remix dev server for custom servers
  scripts["dev"] = "cross-env NODE_ENV=production netlify dev";

  // The start script is not required as the dev script does the same thing
  delete dependencies["start"];

  delete dependencies["@remix-run/netlify"];
  delete dependencies["@remix-run/node"];
  dependencies["@remix-run/netlify-edge"] = "*";

  packageJson.update({
    ...restOfPackageJson,
    dependencies,
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
