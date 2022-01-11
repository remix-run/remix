module.exports = (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
) => {
  const configOverrides: Partial<Cypress.PluginConfigOptions> = {
    baseUrl: process.env.BASE_URL ?? "http://localhost:3333",
    viewportWidth: 1030,
    viewportHeight: 800,
    integrationFolder: "cypress/e2e",
    video: !process.env.CI,
    screenshotOnRunFailure: !process.env.CI
  };

  Object.assign(config, configOverrides);

  on("task", {
    log(message) {
      console.log(message);
      return null;
    }
  });

  return config;
};
