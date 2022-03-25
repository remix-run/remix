// This class exists to prevent https://github.com/remix-run/remix/issues/2031 from occuring
export class RemixNotSetupError extends Error {
  constructor() {
    super("Did you forget to run `remix setup` for your platform?");
  }
}

throw new RemixNotSetupError();
