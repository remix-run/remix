const { execSync } = require("node:child_process");

const main = async ({ rootDirectory }) => {
  execSync(`npm run build`, { stdio: "inherit", cwd: rootDirectory });
  execSync(`npm run setup`, { stdio: "inherit", cwd: rootDirectory });

  console.log(
    `Setup is complete. You're now ready to rock and roll 🤘

Start development with \`npm run dev\`
    `.trim()
  );
};

module.exports = main;
