module.exports = (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
) => {
  const port = process.env.PORT ?? 3333;
  const configOverrides: Partial<Cypress.PluginConfigOptions> = {
    baseUrl: `http://localhost:${port}`,
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
