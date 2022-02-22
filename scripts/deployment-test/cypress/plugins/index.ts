module.exports = (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
) => {
  const configOverrides: Partial<Cypress.PluginConfigOptions> = {
    viewportWidth: 1030,
    viewportHeight: 800,
    integrationFolder: "cypress/e2e",
    video: !process.env.CI,
    screenshotOnRunFailure: !process.env.CI,
  };
  Object.assign(config, configOverrides);

  on("task", {
    log(message) {
      console.log(message);
      return null;
    },
  });

  return config;
};
