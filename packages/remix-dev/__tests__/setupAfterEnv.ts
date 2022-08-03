export let jestTimeout = process.platform === "win32" ? 15_000 : 10_000;

jest.setTimeout(jestTimeout);
