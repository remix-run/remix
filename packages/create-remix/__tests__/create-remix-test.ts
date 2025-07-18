import * as readline from "readline";
import crossSpawn from "cross-spawn";

import { createRemix } from "../index";

// Mock dependencies
jest.mock("readline");
jest.mock("cross-spawn");

describe("createRemix", () => {
  let mockReadline: any;
  let mockSpawn: any;
  let mockChildProcess: any;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock console.log
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    // Setup readline mock
    mockReadline = {
      question: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
    };
    (readline.createInterface as jest.Mock).mockReturnValue(mockReadline);

    // Setup child process mock
    mockChildProcess = {
      on: jest.fn(),
    };
    mockSpawn = crossSpawn as jest.MockedFunction<typeof crossSpawn>;
    mockSpawn.mockReturnValue(mockChildProcess as any);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("when user confirms with 'y'", () => {
    it("should spawn the command and resolve on successful exit", async () => {
      // Arrange
      let argv = ["--template", "my-template"];
      let questionCallback: Function;
      let exitHandler: Function;

      // Capture the question callback
      mockReadline.question.mockImplementation(
        (question: string, callback: Function) => {
          questionCallback = callback;
        }
      );

      // Capture the child process event handlers
      mockChildProcess.on.mockImplementation(
        (event: string, handler: Function) => {
          if (event === "exit") {
            exitHandler = handler;
          }
          return mockChildProcess;
        }
      );

      // Act
      let promise = createRemix(argv);

      // Simulate user answering 'y'
      questionCallback!("y");

      // Simulate successful exit
      exitHandler!(0);

      await promise;

      // Assert
      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "\nDid you mean `npx create-react-router@latest`?\n"
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "\nRunning: npx create-react-router@latest\n"
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        ["create-react-router@latest", "--template", "my-template"],
        {
          stdio: "inherit",
          env: process.env,
        }
      );

      expect(mockReadline.close).toHaveBeenCalled();
    });

    it("should reject when child process exits with non-zero code", async () => {
      // Arrange
      let questionCallback: Function;
      let exitHandler: Function;

      mockReadline.question.mockImplementation(
        (question: string, callback: Function) => {
          questionCallback = callback;
        }
      );

      mockChildProcess.on.mockImplementation(
        (event: string, handler: Function) => {
          if (event === "exit") {
            exitHandler = handler;
          }
          return mockChildProcess;
        }
      );

      // Act
      let promise = createRemix([]);
      questionCallback!("y");
      exitHandler!(1);

      // Assert
      await expect(promise).rejects.toThrow("Command failed with exit code 1");
      expect(mockReadline.close).toHaveBeenCalled();
    });

    it("should reject when child process emits error", async () => {
      // Arrange
      let error = new Error("Spawn error");
      let questionCallback: Function;
      let errorHandler: Function;

      mockReadline.question.mockImplementation(
        (question: string, callback: Function) => {
          questionCallback = callback;
        }
      );

      mockChildProcess.on.mockImplementation(
        (event: string, handler: Function) => {
          if (event === "error") {
            errorHandler = handler;
          }
          return mockChildProcess;
        }
      );

      // Act
      let promise = createRemix([]);
      questionCallback!("y");
      errorHandler!(error);

      // Assert
      await expect(promise).rejects.toThrow("Spawn error");
      expect(mockReadline.close).toHaveBeenCalled();
    });
  });

  describe("when user confirms with 'yes'", () => {
    it("should spawn the command (case insensitive)", async () => {
      // Arrange
      let questionCallback: Function;
      let exitHandler: Function;

      mockReadline.question.mockImplementation(
        (question: string, callback: Function) => {
          questionCallback = callback;
        }
      );

      mockChildProcess.on.mockImplementation(
        (event: string, handler: Function) => {
          if (event === "exit") {
            exitHandler = handler;
          }
          return mockChildProcess;
        }
      );

      // Act
      let promise = createRemix([]);
      questionCallback!("YES");
      exitHandler!(0);

      await promise;

      // Assert
      expect(mockSpawn).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "\nRunning: npx create-react-router@latest\n"
      );
    });
  });

  describe("when user declines", () => {
    it("should not spawn command when user answers 'n'", async () => {
      // Arrange
      let questionCallback: Function;

      mockReadline.question.mockImplementation(
        (question: string, callback: Function) => {
          questionCallback = callback;
        }
      );

      // Act
      let promise = createRemix([]);
      questionCallback!("n");

      await promise;

      // Assert
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith("\nCommand not executed.");
      expect(mockReadline.close).toHaveBeenCalled();
    });

    it("should not spawn command when user answers anything else", async () => {
      // Arrange
      let questionCallback: Function;

      mockReadline.question.mockImplementation(
        (question: string, callback: Function) => {
          questionCallback = callback;
        }
      );

      // Act
      let promise = createRemix([]);
      questionCallback!("maybe");

      await promise;

      // Assert
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith("\nCommand not executed.");
      expect(mockReadline.close).toHaveBeenCalled();
    });
  });

  describe("when readline is closed without answer", () => {
    it("should reject with appropriate error", async () => {
      // Arrange
      let rlCloseHandler: Function;
      let hasAnswered = false;

      mockReadline.on.mockImplementation((event: string, handler: Function) => {
        if (event === "close") {
          rlCloseHandler = handler;
        }
        return mockReadline;
      });

      mockReadline.question.mockImplementation(
        (question: string, callback: Function) => {
          // Don't call the callback - simulate closing without answering
        }
      );

      mockReadline.close.mockImplementation(() => {
        if (!hasAnswered && rlCloseHandler) {
          rlCloseHandler();
        }
      });

      // Act
      let promise = createRemix([]);

      // Simulate closing readline without answering
      mockReadline.close();

      // Assert
      await expect(promise).rejects.toThrow(
        "User did not confirm command execution"
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty argv array", async () => {
      // Arrange
      let questionCallback: Function;
      let exitHandler: Function;

      mockReadline.question.mockImplementation(
        (question: string, callback: Function) => {
          questionCallback = callback;
        }
      );

      mockChildProcess.on.mockImplementation(
        (event: string, handler: Function) => {
          if (event === "exit") {
            exitHandler = handler;
          }
          return mockChildProcess;
        }
      );

      // Act
      let promise = createRemix([]);
      questionCallback!("y");
      exitHandler!(0);

      await promise;

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        ["create-react-router@latest"],
        expect.any(Object)
      );
    });

    it("should pass through multiple arguments", async () => {
      // Arrange
      let argv = ["--template", "remix", "--install", "--typescript"];
      let questionCallback: Function;
      let exitHandler: Function;

      mockReadline.question.mockImplementation(
        (question: string, callback: Function) => {
          questionCallback = callback;
        }
      );

      mockChildProcess.on.mockImplementation(
        (event: string, handler: Function) => {
          if (event === "exit") {
            exitHandler = handler;
          }
          return mockChildProcess;
        }
      );

      // Act
      let promise = createRemix(argv);
      questionCallback!("y");
      exitHandler!(0);

      await promise;

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        [
          "create-react-router@latest",
          "--template",
          "remix",
          "--install",
          "--typescript",
        ],
        expect.any(Object)
      );
    });
  });
});
