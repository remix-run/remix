const inquirer = require("inquirer");
const fs = require("fs/promises");
const { join } = require("path");

const files = [
  ["README.md"],
  ["netlify.toml"],
  ["edge-server.js", "server.js"],
  ["remix.config-edge.js", "remix.config.js"],
  ["vscode.json", join(".vscode", "settings.json")],
  ["app/entry.server.tsx"],
  ["app/root.tsx"],
];

async function main({ rootDirectory }) {
  if (await shouldUseEdge()) {
    await fs.mkdir(join(rootDirectory, ".vscode"));

    for (let [file, target] of files) {
      await fs.copyFile(
        join(rootDirectory, "remix.init", file),
        join(rootDirectory, target || file)
      );
    }
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
