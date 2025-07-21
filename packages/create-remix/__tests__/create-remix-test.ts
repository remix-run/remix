import { createRemix } from "../index";

describe("createRemix", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console.log
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should display migration message with basic command", async () => {
    await createRemix([]);

    expect(consoleLogSpy).toHaveBeenCalledWith("\n🔄 Remix is now part of React Router!");
    expect(consoleLogSpy).toHaveBeenCalledWith("\nRemix has been upstreamed into React Router and is now in maintenance mode.");
    expect(consoleLogSpy).toHaveBeenCalledWith("For new projects, please use React Router instead.");
    expect(consoleLogSpy).toHaveBeenCalledWith("\nTo create a new React Router project, run:");
    expect(consoleLogSpy).toHaveBeenCalledWith("\n  npx create-react-router@latest\n");
    expect(consoleLogSpy).toHaveBeenCalledWith("Learn more: https://reactrouter.com\n");
  });

  it("should display migration message with template argument", async () => {
    await createRemix(["--template", "my-template"]);

    expect(consoleLogSpy).toHaveBeenCalledWith("\n🔄 Remix is now part of React Router!");
    expect(consoleLogSpy).toHaveBeenCalledWith("\n  npx create-react-router@latest --template my-template\n");
  });

  it("should display migration message with multiple arguments", async () => {
    await createRemix(["--template", "remix", "--install", "--typescript"]);

    expect(consoleLogSpy).toHaveBeenCalledWith("\n🔄 Remix is now part of React Router!");
    expect(consoleLogSpy).toHaveBeenCalledWith("\n  npx create-react-router@latest --template remix --install --typescript\n");
  });

  it("should handle empty argv array", async () => {
    await createRemix([]);

    expect(consoleLogSpy).toHaveBeenCalledWith("\n  npx create-react-router@latest\n");
  });
});
